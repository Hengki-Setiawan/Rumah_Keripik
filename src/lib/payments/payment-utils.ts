import { randomUUID } from 'crypto';

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
