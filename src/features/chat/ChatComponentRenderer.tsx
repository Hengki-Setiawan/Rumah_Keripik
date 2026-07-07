'use client';

import type { ChatCartDto, ChatComponent } from '@/lib/chat-v3/types';
import { ProductCards } from './components/ProductCards';
import { QuickReplies } from './components/QuickReplies';
import { CartSummaryCard } from './components/CartSummaryCard';
import { PaymentMethodsCard } from './components/PaymentMethodsCard';
import { LocationPickerCard } from './components/LocationPickerCard';
import { AddressConfirmCard, AdminHandoffCard, CustomerConfirmCard, OrderStatusCard, OrderSummaryCard, PaymentUploadCard } from './components/SimpleCards';

export function ChatComponentRenderer({ components, cart, onSend, onAction }: { components: ChatComponent[]; cart?: ChatCartDto | null; onSend: (message: string) => void; onAction: (action: string, payload?: Record<string, unknown>) => void }) {
  return (
    <div className="w-full space-y-3">
      {components.map((component, index) => {
        if (component.type === 'product_cards') return <ProductCards key={index} component={component} onAction={onAction} />;
        if (component.type === 'quick_replies') return <QuickReplies key={index} component={component} onSend={onSend} onAction={onAction} />;
        if (component.type === 'cart_summary') return <CartSummaryCard key={index} component={component} cart={cart} onAction={onAction} />;
        if (component.type === 'payment_methods') return <PaymentMethodsCard key={index} component={component} onAction={onAction} />;
        if (component.type === 'location_picker') return <LocationPickerCard key={index} component={component} onSend={onSend} />;
        if (component.type === 'customer_confirm') return <CustomerConfirmCard key={index} component={component} onAction={onAction} />;
        if (component.type === 'address_confirm') return <AddressConfirmCard key={index} component={component} onAction={onAction} />;
        if (component.type === 'payment_upload') return <PaymentUploadCard key={index} component={component} onAction={onAction} />;
        if (component.type === 'order_summary') return <OrderSummaryCard key={index} component={component} onAction={onAction} />;
        if (component.type === 'order_status_card') return <OrderStatusCard key={index} component={component} />;
        if (component.type === 'admin_handoff_card') return <AdminHandoffCard key={index} component={component} />;
        return null;
      })}
    </div>
  );
}
