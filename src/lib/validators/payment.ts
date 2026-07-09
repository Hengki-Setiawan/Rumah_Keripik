import { z } from 'zod';

export const PaymentMethodSchema = z.object({
  type: z.enum(['bank_transfer', 'qris', 'ewallet', 'cod']),
  label: z.string().min(1).max(120),
  account_name: z.string().max(120).optional().nullable(),
  account_number: z.string().max(80).optional().nullable(),
  bank_name: z.string().max(80).optional().nullable(),
  qris_public_id: z.string().max(255).optional().nullable(),
  qris_image_url: z.string().max(1000).optional().nullable(),
  note: z.string().max(500).optional().nullable(),
  min_order_total: z.number().int().min(0).optional().nullable(),
  max_order_total: z.number().int().min(0).optional().nullable(),
  sort_order: z.number().int().min(0).default(0),
  is_active: z.number().int().min(0).max(1).default(1),
});

export const PaymentProofCompleteSchema = z.object({
  orderId: z.string().min(1),
  statusToken: z.string().min(8).max(128),
  paymentIntentId: z.string().min(1).optional(),
  cloudinaryPublicId: z.string().min(1),
  secureUrl: z.string().url(),
  originalFilename: z.string().max(255).optional(),
  fileFormat: z.enum(['jpg', 'jpeg', 'png', 'webp']),
  fileSizeBytes: z.number().int().min(1).max(5 * 1024 * 1024, 'Ukuran bukti pembayaran maksimal 5 MB'),
  amountClaimed: z.number().int().min(0).optional(),
});

export const PAYMENT_REJECT_REASONS = [
  'amount_mismatch',
  'blurry_or_unreadable',
  'duplicate_proof',
  'wrong_recipient',
  'invalid_or_edited_proof',
  'payment_not_found',
  'other',
] as const;

export const PaymentProofDecisionSchema = z.object({
  reasonCode: z.enum(PAYMENT_REJECT_REASONS).optional(),
  note: z.string().max(500).optional(),
});

export type PaymentMethodInput = z.infer<typeof PaymentMethodSchema>;
