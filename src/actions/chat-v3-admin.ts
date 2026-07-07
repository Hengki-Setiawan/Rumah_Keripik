'use server';

import { and, desc, eq, like, or, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { requireAdminActor, requireAdminRole } from '@/lib/admin-actor';
import { logAdminAudit } from '@/lib/admin-audit';
import { chatCartItems, chatCarts, chatMessages, chatSessions, customerProfile, detailTransaksi, orderStatusHistory, produk, produkVarian, transaksi } from '@/lib/schema';
import { createChatMessage, getChatMessages, parseComponents } from '@/lib/chat-v3/messages';
import { getCustomerContextForChat } from '@/lib/chat-v3/customer-context';
import { getChatCart } from '@/lib/ai/tools/cart';
import { getActivePaymentMethods } from '@/lib/ai/tools/payment';
import { searchProducts } from '@/lib/ai/tools/products';
import { logAiLearningEvent } from '@/lib/ai/learning-events';
import type { ChatComponent } from '@/lib/chat-v3/types';

export type ChatV3Filters = {
  search?: string;
  status?: string;
  aiMode?: string;
};

export async function getChatV3Sessions(filters: ChatV3Filters = {}) {
  await requireAdminActor();
  const clauses = [];
  if (filters.status && filters.status !== 'all') clauses.push(eq(chatSessions.status, filters.status as 'active' | 'needs_admin' | 'closed' | 'archived'));
  if (filters.aiMode && filters.aiMode !== 'all') clauses.push(eq(chatSessions.aiMode, filters.aiMode as 'enabled' | 'manual' | 'paused'));
  if (filters.search?.trim()) {
    const q = `%${filters.search.trim()}%`;
    clauses.push(or(like(chatSessions.id, q), like(chatSessions.title, q), like(customerProfile.nama, q), like(customerProfile.phone, q), like(transaksi.kode_pesanan, q))!);
  }

  return db
    .select({
      id: chatSessions.id,
      title: chatSessions.title,
      status: chatSessions.status,
      aiMode: chatSessions.aiMode,
      activeOrderId: chatSessions.activeOrderId,
      updatedAt: chatSessions.updatedAt,
      createdAt: chatSessions.createdAt,
      customerName: customerProfile.nama,
      customerPhone: customerProfile.phone,
      orderCode: transaksi.kode_pesanan,
      orderStatus: transaksi.order_status,
      paymentStatus: transaksi.payment_status,
      totalAmount: transaksi.total_bayar,
    })
    .from(chatSessions)
    .leftJoin(customerProfile, eq(chatSessions.customerId, customerProfile.id_customer))
    .leftJoin(transaksi, eq(chatSessions.activeOrderId, transaksi.id_transaksi))
    .where(clauses.length ? and(...clauses) : undefined)
    .orderBy(desc(chatSessions.updatedAt))
    .limit(60);
}

export async function getChatV3Detail(chatSessionId: string) {
  await requireAdminActor();
  const [session] = await db.select().from(chatSessions).where(eq(chatSessions.id, chatSessionId)).limit(1);
  const [messages, cart, customerContext, orderRows, statusEvents] = await Promise.all([
    getChatMessages(chatSessionId, 120),
    getChatCart(chatSessionId),
    getCustomerContextForChat(chatSessionId),
    session?.activeOrderId ? db.select().from(transaksi).where(eq(transaksi.id_transaksi, session.activeOrderId)).limit(1) : Promise.resolve([]),
    session?.activeOrderId
      ? db.select().from(orderStatusHistory).where(eq(orderStatusHistory.id_transaksi, session.activeOrderId)).orderBy(desc(orderStatusHistory.created_at)).limit(20).catch(() => [])
      : Promise.resolve([]),
  ]);
  const componentHistory = messages.flatMap((message) => message.components.map((component) => ({ messageId: message.id, type: component.type, createdAt: message.createdAt })));
  return { messages, cart, customerContext, order: orderRows[0] || null, componentHistory, statusEvents };
}

export async function setChatV3AiMode(chatSessionId: string, mode: 'enabled' | 'manual' | 'paused') {
  const { actor } = await requireAdminRole('chat:manage');
  await db.update(chatSessions).set({ aiMode: mode, status: mode === 'enabled' ? 'active' : 'needs_admin', updatedAt: sql`(datetime('now', 'utc'))` }).where(eq(chatSessions.id, chatSessionId));
  await createChatMessage({ chatSessionId, role: 'system', content: mode === 'enabled' ? 'Chat dikembalikan ke AI.' : 'Chat diambil alih admin.', metadata: { adminAction: 'set_ai_mode', mode, actor } });
  await auditHubAction(chatSessionId, actor, 'set_ai_mode', { mode });
  await logAdminAudit({ actor, action: 'set_chat_ai_mode', resourceType: 'chat_session', resourceId: chatSessionId, metadata: { mode } });
  revalidatePath('/hub-komunikasi');
  return { ok: true };
}

export async function sendChatV3AdminMessage(chatSessionId: string, content: string) {
  const { actor } = await requireAdminRole('chat:manage');
  if (!content.trim()) return { ok: false, error: 'Pesan kosong' };
  await createChatMessage({ chatSessionId, role: 'admin', content: content.trim(), metadata: { source: 'hub-komunikasi', actor } });
  await db.update(chatSessions).set({ aiMode: 'manual', status: 'needs_admin', updatedAt: sql`(datetime('now', 'utc'))` }).where(eq(chatSessions.id, chatSessionId));
  await auditHubAction(chatSessionId, actor, 'send_admin_message', { length: content.trim().length });
  await logAdminAudit({ actor, action: 'send_chat_message', resourceType: 'chat_session', resourceId: chatSessionId, metadata: { length: content.trim().length } });
  revalidatePath('/hub-komunikasi');
  return { ok: true };
}

export async function sendChatV3Card(chatSessionId: string, type: 'quick_replies' | 'product_cards' | 'location_picker' | 'payment_methods' | 'order_status_card', payload: Record<string, unknown> = {}) {
  const { actor } = await requireAdminRole('chat:manage');
  const component = await buildAdminComponent(chatSessionId, type, payload);
  await createChatMessage({ chatSessionId, role: 'admin', content: adminCardMessage(type), components: [component], metadata: { source: 'hub-komunikasi', cardType: type, actor } });
  await db.update(chatSessions).set({ aiMode: 'manual', status: 'needs_admin', updatedAt: sql`(datetime('now', 'utc'))` }).where(eq(chatSessions.id, chatSessionId));
  await auditHubAction(chatSessionId, actor, 'send_card', { cardType: type });
  await logAdminAudit({ actor, action: 'send_chat_card', resourceType: 'chat_session', resourceId: chatSessionId, metadata: { cardType: type } });
  revalidatePath('/hub-komunikasi');
  return { ok: true };
}

async function auditHubAction(chatSessionId: string, actor: string, action: string, metadata: Record<string, unknown>) {
  await logAiLearningEvent({
    eventType: 'admin_hub_action',
    chatSessionId,
    outcome: action,
    metadata: { actor, ...metadata },
  }).catch(() => undefined);
}

async function buildAdminComponent(chatSessionId: string, type: 'quick_replies' | 'product_cards' | 'location_picker' | 'payment_methods' | 'order_status_card', payload: Record<string, unknown>): Promise<ChatComponent> {
  if (type === 'quick_replies') {
    const labels = String(payload.labels || 'Lihat produk,Cek keranjang,Pilih pembayaran').split(',').map((item) => item.trim()).filter(Boolean).slice(0, 6);
    return { type: 'quick_replies', options: labels.map((label, index) => ({ id: `admin-${index}`, label, value: label, action: 'send_message' })) };
  }
  if (type === 'product_cards') {
    const productIds = String(payload.productIds || '').split(',').map((item) => item.trim()).filter(Boolean);
    const products = productIds.length ? await searchProducts(undefined, productIds) : await searchProducts();
    return { type: 'product_cards', productIds: products.slice(0, 6).map((product) => product.id), reason: 'Dikirim manual oleh admin' };
  }
  if (type === 'location_picker') return { type: 'location_picker', mode: 'both' };
  if (type === 'payment_methods') {
    const methods = await getActivePaymentMethods();
    return { type: 'payment_methods', methodIds: methods.map((method) => method.id) };
  }
  const [session] = await db.select().from(chatSessions).where(eq(chatSessions.id, chatSessionId)).limit(1);
  const [order] = session?.activeOrderId ? await db.select().from(transaksi).where(eq(transaksi.id_transaksi, session.activeOrderId)).limit(1) : [];
  return { type: 'order_status_card', orderId: order?.id_transaksi || session?.activeOrderId || chatSessionId, orderCode: order?.kode_pesanan || null, status: order?.order_status, paymentStatus: order?.payment_status, deliveryStatus: order?.order_status, totalAmount: order?.total_bayar };
}

function adminCardMessage(type: string) {
  if (type === 'product_cards') return 'Admin mengirim pilihan produk untuk kakak.';
  if (type === 'location_picker') return 'Admin meminta lokasi pengiriman.';
  if (type === 'payment_methods') return 'Admin mengirim pilihan pembayaran.';
  if (type === 'order_status_card') return 'Admin mengirim update status pesanan.';
  return 'Admin mengirim pilihan cepat.';
}
