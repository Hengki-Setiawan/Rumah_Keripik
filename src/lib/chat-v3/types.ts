export type ChatRole = 'user' | 'assistant' | 'admin' | 'system' | 'tool';

export type MaskedCustomerSummary = {
  id: string;
  name: string | null;
  phoneMasked: string | null;
  tags?: string[];
};

export type AddressSummary = {
  id: number;
  label: string | null;
  recipientName: string | null;
  phoneMasked: string | null;
  addressSummary: string;
  latitude?: string | null;
  longitude?: string | null;
  isDefault?: boolean;
};

export type CustomerMemorySummary = {
  id: string;
  key: string;
  value: string;
  confidence: number;
  source: 'chat' | 'order' | 'admin' | 'system';
  visibility: 'ai' | 'admin' | 'both';
  reviewedByAdmin: boolean;
};

export type ChatComponent =
  | ProductCardsComponent
  | QuickRepliesComponent
  | CartSummaryComponent
  | CustomerConfirmComponent
  | AddressConfirmComponent
  | LocationPickerComponent
  | PaymentMethodsComponent
  | PaymentUploadComponent
  | OrderSummaryComponent
  | OrderStatusComponent
  | AdminHandoffComponent;

export type ProductCardsComponent = {
  type: 'product_cards';
  productIds: string[];
  reason?: string;
  layout?: 'horizontal' | 'grid';
  actions?: Array<'add_to_cart' | 'view_detail' | 'choose_package'>;
};

export type QuickRepliesComponent = {
  type: 'quick_replies';
  options: Array<{
    id: string;
    label: string;
    value: string;
    action: 'send_message' | 'tool_action';
  }>;
};

export type CartSummaryComponent = {
  type: 'cart_summary';
  cartId: string;
};

export type CustomerConfirmComponent = {
  type: 'customer_confirm';
  customerId?: string;
  maskedFields: true;
  customer?: MaskedCustomerSummary;
  actions?: string[];
};

export type AddressConfirmComponent = {
  type: 'address_confirm';
  addressId?: number;
  address?: AddressSummary;
  actions?: string[];
};

export type LocationPickerComponent = {
  type: 'location_picker';
  mode: 'current_location' | 'manual_pick' | 'both';
  addressDraftId?: string;
};

export type PaymentMethodsComponent = {
  type: 'payment_methods';
  orderId?: string;
  methodIds: string[];
};

export type PaymentUploadComponent = {
  type: 'payment_upload';
  orderId: string;
  statusToken?: string;
  allowedTypes?: Array<'image/jpeg' | 'image/png' | 'application/pdf'>;
  maxSizeMb?: number;
  qrCodeUrl?: string | null;
  amount?: number;
};

export type OrderSummaryComponent = {
  type: 'order_summary';
  orderDraftId: string;
  paymentMethodId?: string;
  savedCustomerId?: string;
  savedAddressId?: number;
  actions?: Array<'confirm_order' | 'edit_cart' | 'edit_address'>;
};

export type OrderStatusComponent = {
  type: 'order_status_card';
  orderId: string;
  orderCode?: string | null;
  status?: string;
  paymentStatus?: string;
  deliveryStatus?: string;
  totalAmount?: number;
};

export type AdminHandoffComponent = {
  type: 'admin_handoff_card';
  reason?: string;
};

export type AIChatIntent =
  | 'small_talk'
  | 'ask_clarification'
  | 'recommend_products'
  | 'show_products'
  | 'add_to_cart'
  | 'update_cart'
  | 'show_cart'
  | 'ask_customer_data'
  | 'confirm_customer_data'
  | 'request_location'
  | 'confirm_order'
  | 'show_payment'
  | 'track_order'
  | 'handoff_to_admin'
  | 'unsupported';

export type AIChatResponse = {
  reply: string;
  intent: AIChatIntent;
  components?: ChatComponent[];
  nextAction?: string;
  shouldCallTool?: boolean;
  toolName?: string;
  toolArgs?: Record<string, unknown>;
  confidence?: number;
  metadata?: Record<string, unknown>;
};

export type ChatMessageDto = {
  id: string;
  role: ChatRole;
  content: string;
  components: ChatComponent[];
  metadata?: Record<string, unknown>;
  createdAt: string;
};

export type ChatCartItemDto = {
  id: string;
  productId: string;
  variantId?: string | null;
  productName: string;
  variantName?: string | null;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  stock: number;
  imageUrl?: string | null;
};

export type ChatCartDto = {
  id: string;
  items: ChatCartItemDto[];
  total: number;
  itemCount: number;
};

export type CustomerContextDto = {
  customer: MaskedCustomerSummary | null;
  addresses: AddressSummary[];
  defaultAddress: AddressSummary | null;
  memory: CustomerMemorySummary[];
  lastOrder?: {
    id: string;
    code: string | null;
    status: string;
    paymentStatus: string;
    totalAmount: number;
  } | null;
};
