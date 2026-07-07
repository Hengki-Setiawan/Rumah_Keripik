import { NextResponse } from 'next/server';
import { and, eq, ne, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { detailTransaksi, orderStatusHistory, paymentIntent, paymentProof, produk, produkVarian, transaksi } from '@/lib/schema';
import { PaymentProofDecisionSchema } from '@/lib/validators/payment';
import { isForbiddenAdminPermissionError, isUnauthorizedAdminError, requireAdminRole } from '@/lib/admin-actor';
import { canApprovePaymentProof } from '@/lib/order-status-policy';
import { notifyChatForOrderEvent } from '@/lib/chat-v3/order-notifications';
import { logAdminAudit } from '@/lib/admin-audit';

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(req: Request, context: RouteContext) {
  const { id } = await context.params;
  const parsed = PaymentProofDecisionSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ ok: false, error: 'Payload tidak valid' }, { status: 400 });

  const [proof] = await db.select().from(paymentProof).where(eq(paymentProof.id_payment_proof, id)).limit(1);
  if (!proof) return NextResponse.json({ ok: false, error: 'Bukti pembayaran tidak ditemukan' }, { status: 404 });

  const [order] = await db.select().from(transaksi).where(eq(transaksi.id_transaksi, proof.id_transaksi)).limit(1);
  if (!order) return NextResponse.json({ ok: false, error: 'Pesanan tidak ditemukan' }, { status: 404 });
  if (!canApprovePaymentProof(order, proof)) return NextResponse.json({ ok: false, error: 'Bukti pembayaran tidak bisa di-approve pada status saat ini' }, { status: 409 });

  let actor = 'admin';
  try {
    const role = await requireAdminRole('payment:verify');
    actor = role.actor;
    await db.transaction(async (tx) => {
    const [stockDeducted] = await tx
      .select({ id: orderStatusHistory.id })
      .from(orderStatusHistory)
      .where(and(eq(orderStatusHistory.id_transaksi, proof.id_transaksi), eq(orderStatusHistory.event_type, 'STOCK_DEDUCTED')))
      .limit(1);

    if (!stockDeducted) {
      const details = await tx.select().from(detailTransaksi).where(eq(detailTransaksi.id_transaksi, proof.id_transaksi));
      for (const detail of details) {
        if (detail.id_varian) {
          const result = await tx
            .update(produkVarian)
            .set({ stok: sql`${produkVarian.stok} - ${detail.qty_terjual}` })
            .where(and(eq(produkVarian.id_varian, detail.id_varian), sql`${produkVarian.stok} >= ${detail.qty_terjual}`));
          if (result.rowsAffected === 0) throw new Error(`Stok varian ${detail.nama_varian_snapshot || detail.id_varian} tidak cukup`);
        } else {
          const result = await tx
            .update(produk)
            .set({ stok_gudang_utama: sql`${produk.stok_gudang_utama} - ${detail.qty_terjual}` })
            .where(and(eq(produk.id_produk, detail.id_produk), sql`${produk.stok_gudang_utama} >= ${detail.qty_terjual}`));
          if (result.rowsAffected === 0) throw new Error(`Stok produk ${detail.nama_produk_snapshot || detail.id_produk} tidak cukup`);
        }
      }
      await tx.insert(orderStatusHistory).values({ id_transaksi: proof.id_transaksi, order_status: order.order_status, payment_status: order.payment_status, event_type: 'STOCK_DEDUCTED', actor: 'system', metadata_json: JSON.stringify({ reason: 'payment_approved' }) });
    }

    await tx.update(paymentProof).set({ status: 'rejected', verified_by: actor, verified_at: sql`(datetime('now', 'utc'))`, admin_note: 'Ditutup otomatis karena bukti lain sudah disetujui.' }).where(and(eq(paymentProof.id_transaksi, proof.id_transaksi), eq(paymentProof.status, 'pending'), ne(paymentProof.id_payment_proof, id)));
    await tx.update(paymentProof).set({ status: 'accepted', verified_by: actor, verified_at: sql`(datetime('now', 'utc'))`, admin_note: parsed.data.note }).where(eq(paymentProof.id_payment_proof, id));
    await tx.update(transaksi).set({ status_pembayaran: 'Lunas', payment_status: 'verified', order_status: 'processing', verified_by: actor, verified_at: sql`(datetime('now', 'utc'))`, updated_at: sql`(datetime('now', 'utc'))` }).where(eq(transaksi.id_transaksi, proof.id_transaksi));
    await tx.update(paymentIntent).set({ status: 'verified', updated_at: sql`(datetime('now', 'utc'))` }).where(eq(paymentIntent.id_transaksi, proof.id_transaksi));
      await tx.insert(orderStatusHistory).values({ id_transaksi: proof.id_transaksi, order_status: 'processing', payment_status: 'verified', event_type: 'PAYMENT_APPROVED', actor, note: parsed.data.note });
    });
  } catch (error) {
    if (isUnauthorizedAdminError(error)) return NextResponse.json({ ok: false, error: 'Login admin diperlukan' }, { status: 401 });
    if (isForbiddenAdminPermissionError(error)) return NextResponse.json({ ok: false, error: 'Admin tidak punya izin verifikasi pembayaran' }, { status: 403 });
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Gagal approve pembayaran' }, { status: 409 });
  }

  await logAdminAudit({ actor, action: 'approve_payment_proof', resourceType: 'payment_proof', resourceId: id, metadata: { orderId: proof.id_transaksi } });
  await notifyChatForOrderEvent(proof.id_transaksi, 'payment_verified');
  return NextResponse.json({ ok: true });
}
