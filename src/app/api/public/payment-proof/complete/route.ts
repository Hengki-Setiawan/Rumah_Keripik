import { NextResponse } from 'next/server';
import { eq, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { orderEvents, orderStatusHistory, paymentIntent, paymentProof, transaksi, workerJob } from '@/lib/schema';
import { generateIdPaymentProof } from '@/lib/id-generator';
import { PaymentProofCompleteSchema } from '@/lib/validators/payment';
import { safeJsonStringify } from '@/lib/json-utils';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';
import { scorePaymentProof } from '@/lib/payment-proof-scoring';
import { applyDuplicateSignalsToVerification, detectPaymentDuplicateSignals } from '@/lib/payment-duplicate';
import { canUploadPaymentProof, getPaymentProofUploadBlockReason } from '@/lib/order-status-policy';
import { notifyChatForOrderEvent } from '@/lib/chat-v3/order-notifications';

export async function POST(req: Request) {
  const rate = checkRateLimit(`public-proof-complete:${getClientIp(req)}`, 12, 60_000);
  if (!rate.ok) return NextResponse.json({ ok: false, error: 'Terlalu banyak percobaan upload. Coba lagi sebentar.' }, { status: 429 });

  const parsed = PaymentProofCompleteSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.errors[0]?.message || 'Data bukti pembayaran tidak valid' }, { status: 400 });
  }
  if (!isAllowedCloudinaryProofUrl(parsed.data.secureUrl, parsed.data.cloudinaryPublicId)) {
    return NextResponse.json({ ok: false, error: 'URL bukti pembayaran tidak valid' }, { status: 400 });
  }

  const [order] = await db.select().from(transaksi).where(eq(transaksi.id_transaksi, parsed.data.orderId)).limit(1);
  if (!order) return NextResponse.json({ ok: false, error: 'Pesanan tidak ditemukan' }, { status: 404 });
  if (!order.status_token || order.status_token !== parsed.data.statusToken) return NextResponse.json({ ok: false, error: 'Token pesanan tidak valid' }, { status: 403 });
  const existingProofs = await db.select({ status: paymentProof.status }).from(paymentProof).where(eq(paymentProof.id_transaksi, parsed.data.orderId));
  if (!canUploadPaymentProof(order, existingProofs)) return NextResponse.json({ ok: false, error: getPaymentProofUploadBlockReason(order, existingProofs) }, { status: 409 });
  const [intent] = await db.select().from(paymentIntent).where(eq(paymentIntent.id_transaksi, parsed.data.orderId)).limit(1);
  const instruction = parseInstruction(intent?.instruction_json);

  const proofId = generateIdPaymentProof();
  const precheck = scorePaymentProof(
    { amount_claimed: parsed.data.amountClaimed ?? null, status: 'pending', uploaded_at: new Date().toISOString() },
    order,
  );
  let verification = precheck;

  await db.transaction(async (tx) => {
    await tx.insert(paymentProof).values({
      id_payment_proof: proofId,
      id_transaksi: parsed.data.orderId,
      cloudinary_public_id: parsed.data.cloudinaryPublicId,
      secure_url: parsed.data.secureUrl,
      original_filename: parsed.data.originalFilename ?? null,
      file_format: parsed.data.fileFormat ?? null,
      file_size_bytes: parsed.data.fileSizeBytes ?? null,
      amount_claimed: parsed.data.amountClaimed ?? null,
      status: 'pending',
    });

    const [proof] = await tx.select().from(paymentProof).where(eq(paymentProof.id_payment_proof, proofId)).limit(1);
    if (proof) {
      const duplicateSignals = await detectPaymentDuplicateSignals(proof, tx as never);
      verification = applyDuplicateSignalsToVerification(precheck, duplicateSignals);
    }

    await tx.update(transaksi).set({ payment_status: 'proof_uploaded', order_status: 'awaiting_payment_verification', status_pembayaran: 'Menunggu_Verifikasi', bukti_transfer_url: parsed.data.secureUrl, updated_at: sql`(datetime('now', 'utc'))` }).where(eq(transaksi.id_transaksi, parsed.data.orderId));
    await tx.update(paymentIntent).set({ status: 'awaiting_admin_verification', updated_at: sql`(datetime('now', 'utc'))` }).where(eq(paymentIntent.id_transaksi, parsed.data.orderId));
    await tx.insert(orderStatusHistory).values({
      id_transaksi: parsed.data.orderId,
      order_status: 'awaiting_payment_verification',
      payment_status: 'proof_uploaded',
      event_type: 'PAYMENT_PROOF_UPLOADED',
      actor: 'customer',
      metadata_json: safeJsonStringify({ proofId, cloudinaryPublicId: parsed.data.cloudinaryPublicId }),
    });
    await tx.insert(orderEvents).values({
      id_transaksi: parsed.data.orderId,
      no_wa_pelanggan: order.no_hp_penerima || order.no_wa_pelanggan || `web:${order.id_session || parsed.data.orderId}`,
      event_type: 'WEB_PAYMENT_PROOF_UPLOADED',
      event_payload: safeJsonStringify({ proofId, score: verification.score, warnings: verification.warnings }),
    });
    await tx.insert(workerJob).values({
      type: 'payment_proof_ocr_assist',
      payload_json: safeJsonStringify({
        proofId,
        orderId: parsed.data.orderId,
        secureUrl: parsed.data.secureUrl,
        expectedAmount: order.total_bayar,
        expectedReceiverName: instruction?.accountName,
        paymentMethodLabel: instruction?.label,
        amountClaimed: parsed.data.amountClaimed ?? null,
        precheck: verification,
      }),
      priority: verification.level === 'danger' ? 2 : 5,
    });
  });

  await notifyChatForOrderEvent(parsed.data.orderId, 'payment_uploaded');
  return NextResponse.json({ ok: true, proofId });
}

function parseInstruction(value: string | null | undefined) {
  if (!value) return null;
  try {
    return JSON.parse(value) as { label?: string; accountName?: string };
  } catch {
    return null;
  }
}

function isAllowedCloudinaryProofUrl(url: string, publicId: string) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' && parsed.hostname === 'res.cloudinary.com' && parsed.pathname.includes('/payment-proofs/') && parsed.pathname.includes(publicId.split('/').pop() || publicId);
  } catch {
    return false;
  }
}
