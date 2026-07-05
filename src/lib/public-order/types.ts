export type OrderState =
  | 'START'
  | 'BROWSING'
  | 'PRODUCT_LIST_SHOWN'
  | 'PRODUCT_SELECTED'
  | 'VARIANT_SELECTED'
  | 'QUANTITY_SELECTED'
  | 'CART_REVIEW'
  | 'CUSTOMER_INFO_REQUIRED'
  | 'CUSTOMER_INFO_FILLED'
  | 'ADDRESS_REQUIRED'
  | 'ADDRESS_FILLED'
  | 'ORDER_CONFIRMATION'
  | 'ORDER_CREATED'
  | 'PAYMENT_INSTRUCTION_SHOWN'
  | 'CANCELLED';

export type CartItem = {
  productId: string;
  variantId?: string;
  quantity: number;
};

export type CartState = {
  items: CartItem[];
};

export type PublicOrderContext = {
  customer?: {
    name: string;
    phone: string;
  };
  address?: {
    recipientName: string;
    phone: string;
    addressText: string;
    landmark?: string;
    courierNote?: string;
    latitude?: number;
    longitude?: number;
  };
  paymentMethod?: 'bank_transfer' | 'qris' | 'ewallet' | 'cod';
  paymentMethodId?: string;
  order?: {
    idTransaksi: string;
    kodePesanan: string;
    totalBayar: number;
    statusToken?: string;
  };
};

export type ChatUIResponse =
  | {
      type: 'text';
      message: string;
    }
  | {
      type: 'quick_replies';
      message: string;
      options: Array<{ label: string; action: string; value?: string }>;
    }
  | {
      type: 'product_cards';
      message: string;
      products: Array<{
        id: string;
        name: string;
        description: string | null;
        price: number;
        priceLabel: string;
        stock: number;
        stockLabel: string;
        imageUrl: string | null;
        categoryName: string | null;
        actions: Array<{ label: string; action: string; value: string }>;
      }>;
    }
  | {
      type: 'variant_picker';
      message: string;
      productId: string;
      variants: Array<{
        id: string;
        label: string;
        price: number;
        priceLabel: string;
        stock: number;
        disabled?: boolean;
      }>;
    }
  | {
      type: 'quantity_picker';
      message: string;
      productId: string;
      variantId?: string;
      min: number;
      max: number;
      value: number;
    }
  | {
      type: 'cart_summary';
      message: string;
      items: Array<{
        productId: string;
        variantId?: string;
        name: string;
        variantLabel?: string;
        quantity: number;
        unitPrice: number;
        subtotal: number;
      }>;
      subtotal: number;
      subtotalLabel: string;
      actions: Array<{ label: string; action: string; value?: string }>;
    }
  | {
      type: 'customer_info_form';
      message: string;
      fields: Array<{ name: 'name' | 'phone'; label: string; inputType: 'text' | 'tel'; required: boolean }>;
      submitLabel: string;
    }
  | {
      type: 'address_form';
      message: string;
      fields: Array<{ name: string; label: string; inputType: 'text' | 'textarea' | 'tel'; required: boolean }>;
      submitLabel: string;
    }
  | {
      type: 'payment_instruction';
      message: string;
      orderId: string;
      orderCode: string;
      amount: number;
      amountLabel: string;
      statusToken?: string;
      paymentMethods: Array<{
        type: 'bank_transfer' | 'qris' | 'ewallet' | 'cod';
        label: string;
        note?: string;
      }>;
      actions: Array<{ label: string; action: string; value?: string }>;
    }
  | {
      type: 'error';
      message: string;
    };
