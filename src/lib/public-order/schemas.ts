import { z } from 'zod';

export const UserEventSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('text'), text: z.string().min(1).max(500) }),
  z.object({ type: z.literal('button_click'), action: z.string().min(1), value: z.string().optional() }),
  z.object({ type: z.literal('select_category'), categoryId: z.string().min(1) }),
  z.object({ type: z.literal('select_product'), productId: z.string().min(1) }),
  z.object({ type: z.literal('select_variant'), productId: z.string().min(1), variantId: z.string().min(1) }),
  z.object({ type: z.literal('set_quantity'), productId: z.string().min(1), variantId: z.string().optional(), quantity: z.number().int().min(1).max(99) }),
  z.object({ type: z.literal('review_cart') }),
  z.object({
    type: z.literal('submit_customer_info'),
    values: z.object({
      name: z.string().min(2).max(80),
      phone: z.string().min(8).max(24),
    }),
  }),
  z.object({
    type: z.literal('submit_address'),
    values: z.object({
      recipientName: z.string().min(2).max(80),
      phone: z.string().min(8).max(24),
      addressText: z.string().min(8).max(500),
      landmark: z.string().max(160).optional(),
      courierNote: z.string().max(240).optional(),
      latitude: z.number().optional(),
      longitude: z.number().optional(),
    }),
  }),
  z.object({ type: z.literal('select_payment_method'), paymentMethodId: z.string().min(1), method: z.enum(['bank_transfer', 'qris', 'ewallet', 'cod']).optional() }),
  z.object({ type: z.literal('confirm_order') }),
  z.object({ type: z.literal('cancel_order'), reason: z.string().max(200).optional() }),
]);

export type UserEvent = z.infer<typeof UserEventSchema>;
