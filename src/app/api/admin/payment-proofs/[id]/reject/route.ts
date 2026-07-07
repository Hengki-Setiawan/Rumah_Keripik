import { NextResponse } from 'next/server';
import { eq, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { orderStatusHistory, paymentIntent, paymentProof, transaksi } from '@/lib/schema';
import { PaymentProofDecisionSchema } from '@/lib/validators/payment';
import { isUnauthorizedAdminError, requireAdminActor } from '@/lib/admin-actor';
import { canRejectPaymentProof } from '@/lib/order-status-policy';
import { notifyChatForOrderEvent } from '@/lib/chat-v3/order-notifications';

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(req: Request, context: RouteContext) {
  const { id } = await context.params;
  const parsed = PaymentProofDecisionSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ ok: false, error: 'Payload tidak valid' }, { status: 400 });
  if (!parsed.data.reasonCode) return NextResponse.json({ ok: false, error: 'Kode alasan penolakan wajib dipilih' }, { status: 400 });

  const [proof] = await db.select().from(paymentProof).where(eq(paymentProof.id_payment_proof, id)).limit(1);
  if (!proof) return NextResponse.json({ ok: false, error: 'Bukti pembayaran tidak ditemukan' }, { status: 404 });
  const [order] = await db.select().from(transaksi).where(eq(transaksi.id_transaksi, proof.id_transaksi)).limit(1);
  if (!order) return NextResponse.json({ ok: false, error: 'Pesanan tidak ditemukan' }, { status: 404 });
  if (!canRejectPaymentProof(order, proof)) return NextResponse.json({ ok: false, error: 'Bukti pembayaran tidak bisa ditolak pada status saat ini' }, { status: 409 });

  try {
    const actor = await requireAdminActor();
    await db.transaction(async (tx) => {
      const note = `[${parsed.data.reasonCode}] ${parsed.data.note || ''}`.trim();
      await tx.update(paymentProof).set({ status: 'rejected', verified_by: actor, verified_at: sql`(datetime('now', 'utc'))`, admin_note: note }).where(eq(paymentProof.id_payment_proof, id));
      await tx.update(transaksi).set({ payment_status: 'rejected', order_status: 'awaiting_payment', updated_at: sql`(datetime('now', 'utc'))` }).where(eq(transaksi.id_transaksi, proof.id_transaksi));
      await tx.update(paymentIntent).set({ status: 'rejected', updated_at: sql`(datetime('now', 'utc'))` }).where(eq(paymentIntent.id_transaksi, proof.id_transaksi));
      await tx.insert(orderStatusHistory).values({ id_transaksi: proof.id_transaksi, order_status: 'awaiting_payment', payment_status: 'rejected', event_type: 'PAYMENT_REJECTED', actor, note, metadata_json: JSON.stringify({ reasonCode: parsed.data.reasonCode }) });
    });
  } catch (error) {
    if (isUnauthorizedAdminError(error)) return NextResponse.json({ ok: false, error: 'Login admin diperlukan' }, { status: 401 });
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Gagal reject pembayaran' }, { status: 409 });
  }

  await notifyChatForOrderEvent(proof.id_transaksi, 'payment_rejected', { note: parsed.data.note });
  return NextResponse.json({ ok: true });
}
