import { eq, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { orderStatusHistory, paymentIntent, transaksi } from '@/lib/schema';
import { buildGatewayInstructionPayload, buildPaymentInstructionPayload } from './payment-utils';
import { chargeMidtransQris, getPublicAppUrl } from './midtrans';

type MethodLike = {
  id_payment_method: string;
  type: 'bank_transfer' | 'qris' | 'ewallet' | 'cod';
  label: string;
  account_name?: string | null;
  account_number?: string | null;
  bank_name?: string | null;
  qris_public_id?: string | null;
  qris_image_url?: string | null;
  note?: string | null;
};

export async function setupOrderPaymentAfterCreate(input: {
  idTransaksi: string;
  kodePesanan: string;
  totalBayar: number;
  statusToken?: string;
  customer: {
    name: string;
    phone: string;
    email?: string | null;
    address?: string | null;
  };
  method: MethodLike;
  items: Array<{ name: string; price: number; quantity: number }>;
}) {
  if (input.method.type === 'cod') {
    return {
      checkoutUrl: null,
      instruction: buildPaymentInstructionPayload(input.method),
      provider: null,
    };
  }

  const appUrl = getPublicAppUrl();
  const overrideNotificationUrl = appUrl
    ? `${appUrl}/api/webhook/midtrans`
    : undefined;

  // Midtrans charge request
  const chargeResult = await chargeMidtransQris({
    orderId: input.kodePesanan,
    amount: input.totalBayar,
    customer: input.customer,
    items: input.items,
    overrideNotificationUrl,
  });

  if (!chargeResult.ok) {
    const instruction = buildGatewayInstructionPayload({
      methodType: input.method.type,
      label: 'QRIS (Bayar Instan)',
      provider: 'midtrans',
      unavailable: true,
      note: 'Tagihan online belum berhasil dibuat. Coba refresh beberapa saat lagi atau hubungi admin Rumah Keripik.',
    });

    await db.transaction(async (tx) => {
      await tx
        .update(paymentIntent)
        .set({
          instruction_json: JSON.stringify(instruction),
          updated_at: sql`(datetime('now', 'utc'))`,
        })
        .where(eq(paymentIntent.id_transaksi, input.idTransaksi));

      await tx
        .update(transaksi)
        .set({
          admin_note: chargeResult.message,
          updated_at: sql`(datetime('now', 'utc'))`,
        })
        .where(eq(transaksi.id_transaksi, input.idTransaksi));

      await tx.insert(orderStatusHistory).values({
        id_transaksi: input.idTransaksi,
        order_status: 'awaiting_payment',
        payment_status: 'payment_instruction_shown',
        event_type: 'PAYMENT_GATEWAY_SETUP_FAILED',
        actor: 'system',
        note: chargeResult.message,
      });
    });

    return {
      checkoutUrl: null,
      instruction,
      provider: 'midtrans' as const,
    };
  }

  // Extract QRIS code image url from Midtrans actions
  const qrCodeAction = chargeResult.charge.actions?.find((action) => action.name === 'generate-qr-code');
  const qrCodeUrl = qrCodeAction?.url || null;

  const instruction = buildGatewayInstructionPayload({
    methodType: input.method.type,
    label: 'QRIS (Bayar Instan)',
    provider: 'midtrans',
    qrCodeUrl,
    reference: chargeResult.charge.transaction_id || null,
    note: 'Scan QRIS di bawah ini dengan aplikasi pembayaran pilihan Anda (GoPay, ShopeePay, DANA, OVO, m-BCA, Livin, dll).',
  });

  await db.transaction(async (tx) => {
    await tx
      .update(paymentIntent)
      .set({
        instruction_json: JSON.stringify(instruction),
        updated_at: sql`(datetime('now', 'utc'))`,
      })
      .where(eq(paymentIntent.id_transaksi, input.idTransaksi));

    await tx.insert(orderStatusHistory).values({
      id_transaksi: input.idTransaksi,
      order_status: 'awaiting_payment',
      payment_status: 'payment_instruction_shown',
      event_type: 'PAYMENT_GATEWAY_INVOICE_CREATED',
      actor: 'system',
      metadata_json: JSON.stringify({
        provider: 'midtrans',
        reference: chargeResult.charge.transaction_id || null,
        qrCodeUrl,
      }),
    });
  });

  return {
    checkoutUrl: qrCodeUrl, // We return qrCodeUrl as checkoutUrl for instant view
    instruction,
    provider: 'midtrans' as const,
  };
}
