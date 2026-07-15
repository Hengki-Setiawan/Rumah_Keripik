import { z } from 'zod';

const MaskedCustomerSummarySchema = z.object({
  id: z.string().min(1),
  name: z.string().nullable(),
  phoneMasked: z.string().nullable(),
  tags: z.array(z.string()).optional(),
});

const AddressSummarySchema = z.object({
  id: z.number().int(),
  label: z.string().nullable(),
  recipientName: z.string().nullable(),
  phoneMasked: z.string().nullable(),
  addressSummary: z.string().min(1),
  latitude: z.string().nullable().optional(),
  longitude: z.string().nullable().optional(),
  isDefault: z.boolean().optional(),
});

export const ProductCardsComponentSchema = z.object({
  type: z.literal('product_cards'),
  productIds: z.array(z.string().min(1)).min(1).max(8),
  reason: z.string().max(240).optional(),
  layout: z.enum(['horizontal', 'grid']).optional(),
  actions: z.array(z.enum(['add_to_cart', 'view_detail', 'choose_package'])).max(4).optional(),
});

export const QuickRepliesComponentSchema = z.object({
  type: z.literal('quick_replies'),
  options: z.array(z.object({
    id: z.string().min(1),
    label: z.string().min(1).max(48),
    value: z.string().min(1).max(300),
    action: z.enum(['send_message', 'tool_action']),
  })).min(1).max(8),
});

export const CartSummaryComponentSchema = z.object({
  type: z.literal('cart_summary'),
  cartId: z.string().min(1),
});

export const CustomerConfirmComponentSchema = z.object({
  type: z.literal('customer_confirm'),
  customerId: z.string().optional(),
  maskedFields: z.literal(true),
  customer: MaskedCustomerSummarySchema.optional(),
  actions: z.array(z.enum(['use_saved_data', 'edit_data', 'send_new_location'])).max(4).optional(),
});

export const AddressConfirmComponentSchema = z.object({
  type: z.literal('address_confirm'),
  addressId: z.number().int().optional(),
  address: AddressSummarySchema.optional(),
  actions: z.array(z.enum(['use_saved_address', 'edit_address', 'send_new_location'])).max(4).optional(),
});

export const LocationPickerComponentSchema = z.object({
  type: z.literal('location_picker'),
  mode: z.enum(['current_location', 'manual_pick', 'both']),
  addressDraftId: z.string().optional(),
});

export const PaymentMethodsComponentSchema = z.object({
  type: z.literal('payment_methods'),
  orderId: z.string().optional(),
  methodIds: z.array(z.string().min(1)).max(12),
});

export const PaymentUploadComponentSchema = z.object({
  type: z.literal('payment_upload'),
  orderId: z.string().min(1),
  statusToken: z.string().min(8).max(128).optional(),
  allowedTypes: z.array(z.enum(['image/jpeg', 'image/png', 'application/pdf'])).max(6).optional(),
  maxSizeMb: z.number().int().min(1).max(20).optional(),
  qrCodeUrl: z.string().nullable().optional(),
  amount: z.number().optional(),
});

export const OrderSummaryComponentSchema = z.object({
  type: z.literal('order_summary'),
  orderDraftId: z.string().min(1),
  paymentMethodId: z.string().min(1).optional(),
  savedCustomerId: z.string().min(1).optional(),
  savedAddressId: z.number().int().optional(),
  actions: z.array(z.enum(['confirm_order', 'edit_cart', 'edit_address'])).max(4).optional(),
});

export const OrderStatusComponentSchema = z.object({
  type: z.literal('order_status_card'),
  orderId: z.string().min(1),
  orderCode: z.string().nullable().optional(),
  status: z.string().optional(),
  paymentStatus: z.string().optional(),
  deliveryStatus: z.string().optional(),
  totalAmount: z.number().optional(),
});

export const AdminHandoffComponentSchema = z.object({
  type: z.literal('admin_handoff_card'),
  reason: z.string().max(240).optional(),
});

export const ChatComponentSchema = z.discriminatedUnion('type', [
  ProductCardsComponentSchema,
  QuickRepliesComponentSchema,
  CartSummaryComponentSchema,
  CustomerConfirmComponentSchema,
  AddressConfirmComponentSchema,
  LocationPickerComponentSchema,
  PaymentMethodsComponentSchema,
  PaymentUploadComponentSchema,
  OrderSummaryComponentSchema,
  OrderStatusComponentSchema,
  AdminHandoffComponentSchema,
]);

export const AIChatResponseSchema = z.object({
  reply: z.string().min(1).max(500),
  intent: z.enum([
    'small_talk',
    'ask_clarification',
    'recommend_products',
    'show_products',
    'add_to_cart',
    'update_cart',
    'show_cart',
    'ask_customer_data',
    'confirm_customer_data',
    'request_location',
    'confirm_order',
    'show_payment',
    'track_order',
    'handoff_to_admin',
    'unsupported',
  ]),
  components: z.array(ChatComponentSchema).max(6).optional(),
  nextAction: z.string().max(120).optional(),
  shouldCallTool: z.boolean().optional(),
  toolName: z.string().max(80).optional(),
  toolArgs: z.record(z.unknown()).optional(),
  confidence: z.number().min(0).max(1).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const SendChatSchema = z.object({
  chatSessionId: z.string().min(1).optional(),
  message: z.string().min(1).max(1000),
});

export const ChatActionSchema = z.object({
  chatSessionId: z.string().min(1),
  action: z.string().min(1).max(80),
  payload: z.record(z.unknown()).optional(),
});

export const CreateChatOrderSchema = z.object({
  chatSessionId: z.string().min(1),
  customer: z.object({
    name: z.string().min(2).max(80),
    phone: z.string().min(8).max(24),
    pin: z.string().length(4).regex(/^\d+$/).optional(),
    type: z.enum(['konsumen', 'warung', 'reseller']).default('konsumen'),
  }),
  address: z.object({
    text: z.string().min(8).max(500),
    note: z.string().max(240).optional(),
    mapsLink: z.string().max(500).optional(),
    lat: z.string().max(40).optional(),
    lng: z.string().max(40).optional(),
  }),
  paymentMethodId: z.string().min(1),
  notes: z.string().max(360).optional(),
});
