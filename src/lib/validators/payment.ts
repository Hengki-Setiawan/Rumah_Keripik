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
