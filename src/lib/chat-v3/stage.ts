import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { chatSessions, transaksi } from '@/lib/schema';
import { getChatCart } from '@/lib/ai/tools/cart';
import { getCustomerContextForChat } from './customer-context';

export type ChatV3Stage =
  | 'idle'
  | 'product_discovery'
  | 'cart_building'
  | 'customer_data_required'
  | 'address_required'
  | 'payment_selection'
  | 'waiting_payment'
  | 'payment_review'
  | 'processing'
  | 'shipping'
  | 'completed'
  | 'cancelled'
  | 'handoff_to_admin';

export async function getChatV3Stage(chatSessionId: string): Promise<ChatV3Stage> {
  const [session] = await db.select().from(chatSessions).where(eq(chatSessions.id, chatSessionId)).limit(1);
  if (!session) return 'idle';
  if (session.status === 'needs_admin' || session.aiMode !== 'enabled') return 'handoff_to_admin';

  if (session.activeOrderId) {
    const [order] = await db.select().from(transaksi).where(eq(transaksi.id_transaksi, session.activeOrderId)).limit(1);
    if (order) {
      if (order.order_status === 'cancelled' || order.payment_status === 'cancelled') return 'cancelled';
      if (order.order_status === 'completed' || order.order_status === 'delivered') return 'completed';
      if (order.order_status === 'shipping' || order.order_status === 'Dalam_Pengiriman') return 'shipping';
      if (order.order_status === 'processing' || order.payment_status === 'verified' || order.payment_status === 'cod_approved') return 'processing';
      if (order.payment_status === 'proof_uploaded' || order.payment_status === 'awaiting_admin_verification') return 'payment_review';
      return 'waiting_payment';
    }
  }

  const [cart, context] = await Promise.all([getChatCart(chatSessionId), getCustomerContextForChat(chatSessionId)]);
  if (cart.itemCount === 0) return 'product_discovery';
  if (!context.customer) return 'customer_data_required';
  if (!context.defaultAddress) return 'address_required';
  return 'payment_selection';
}

export function canCreateOrderAtStage(stage: ChatV3Stage) {
  return stage === 'payment_selection';
}
