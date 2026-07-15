import { randomUUID } from 'crypto';
import type { PaymentMethod } from '@/lib/schema';

export function generatePaymentMethodId() {
  return `PM-${randomUUID()}`;
}

export function generatePaymentIntentId() {
  return `PI-${randomUUID()}`;
}

export function buildPaymentInstructionPayload(method: {
  type: 'bank_transfer' | 'qris' | 'ewallet' | 'cod';
  label: string;
  account_name?: string | null;
  account_number?: string | null;
  bank_name?: string | null;
  qris_public_id?: string | null;
  qris_image_url?: string | null;
  note?: string | null;
}) {
  return {
    type: method.type,
    label: method.label,
    accountName: method.account_name ?? undefined,
    accountNumber: method.account_number ?? undefined,
    bankName: method.bank_name ?? undefined,
    qrisPublicId: method.qris_public_id ?? undefined,
    qrisImageUrl: method.qris_image_url ?? undefined,
    note: method.note ?? undefined,
  };
}

export function buildGatewayInstructionPayload(input: {
  methodType: 'bank_transfer' | 'qris' | 'ewallet';
  label?: string;
  paymentUrl?: string | null;
  qrCodeUrl?: string | null;
  reference?: string | null;
  provider?: 'duitku' | 'midtrans';
  note?: string | null;
  unavailable?: boolean;
}) {
  return {
    type: input.methodType,
    label: input.label || 'Bayar online via Midtrans',
    provider: input.provider || 'midtrans',
    paymentUrl: input.paymentUrl ?? undefined,
    qrCodeUrl: input.qrCodeUrl ?? undefined,
    reference: input.reference ?? undefined,
    unavailable: input.unavailable ?? false,
    note: input.note ?? undefined,
  };
}

export function buildPublicPaymentMethodOptions(methods: PaymentMethod[]) {
  const onlineBase = methods.find((method) => method.type !== 'cod');
  const codMethod = methods.find((method) => method.type === 'cod');
  const options: Array<{
    id: string;
    type: 'bank_transfer' | 'qris' | 'ewallet' | 'cod';
    label: string;
    accountName?: string;
    accountNumber?: string;
    bankName?: string;
    qrisPublicId?: string;
    qrisImageUrl?: string;
    note?: string;
    minOrderTotal?: number | null;
    maxOrderTotal?: number | null;
    provider?: 'duitku';
  }> = [];

  if (onlineBase) {
    options.push({
      id: onlineBase.id_payment_method,
      type: onlineBase.type,
      label: 'Bayar online',
      note: 'Transfer, QRIS, dan e-wallet dipilih di halaman Duitku setelah pesanan dibuat.',
      minOrderTotal: onlineBase.min_order_total,
      maxOrderTotal: onlineBase.max_order_total,
      provider: 'duitku',
    });
  }

  if (codMethod) {
    options.push({
      id: codMethod.id_payment_method,
      ...buildPaymentInstructionPayload(codMethod),
      minOrderTotal: codMethod.min_order_total,
      maxOrderTotal: codMethod.max_order_total,
    });
  }

  return options;
}
