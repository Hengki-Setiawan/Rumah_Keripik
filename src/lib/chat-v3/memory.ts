import { and, eq, inArray, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { chatCartItems, chatCarts, chatSessions, customerMemoryV3, paymentMethod, produk, produkVarian, transaksi } from '@/lib/schema';
import { generateIdCustomerMemory } from '@/lib/id-generator';
import type { CustomerMemorySummary } from './types';

type MemoryInput = {
  customerId: string;
  key: string;
  value: string;
  confidence?: number;
  source?: 'chat' | 'order' | 'admin' | 'system';
  visibility?: 'ai' | 'admin' | 'both';
  reviewedByAdmin?: boolean;
};

export async function getCustomerMemory(customerId?: string | null, limit = 10): Promise<CustomerMemorySummary[]> {
  if (!customerId) return [];
  const rows = await db
    .select()
    .from(customerMemoryV3)
    .where(and(eq(customerMemoryV3.customerId, customerId), inArray(customerMemoryV3.visibility, ['ai', 'both'])))
    .orderBy(sql`${customerMemoryV3.updatedAt} DESC`)
    .limit(limit);

  return rows.map((row) => ({
    id: row.id,
    key: row.key,
    value: row.value,
    confidence: row.confidence,
    source: row.source,
    visibility: row.visibility,
    reviewedByAdmin: Boolean(row.reviewedByAdmin),
  }));
}

export function buildMemoryPrompt(memory: CustomerMemorySummary[]) {
  if (memory.length === 0) return '';
  return memory
    .slice(0, 10)
    .map((item) => `- ${item.key}: ${item.value}`)
    .join('\n');
}

export async function upsertCustomerMemory(input: MemoryInput) {
  const key = input.key.trim().slice(0, 80);
  const value = input.value.trim().slice(0, 500);
  if (!input.customerId || !key || !value) return null;

  const [existing] = await db
    .select()
    .from(customerMemoryV3)
    .where(and(eq(customerMemoryV3.customerId, input.customerId), eq(customerMemoryV3.key, key)))
    .limit(1);

  if (existing) {
    await db
      .update(customerMemoryV3)
      .set({
        value,
        confidence: input.confidence ?? existing.confidence,
        source: input.source ?? existing.source,
        visibility: input.visibility ?? existing.visibility,
        reviewedByAdmin: input.reviewedByAdmin == null ? existing.reviewedByAdmin : input.reviewedByAdmin ? 1 : 0,
        updatedAt: sql`(datetime('now', 'utc'))`,
      })
      .where(eq(customerMemoryV3.id, existing.id));
    return existing.id;
  }

  const id = generateIdCustomerMemory();
  await db.insert(customerMemoryV3).values({
    id,
    customerId: input.customerId,
    key,
    value,
    confidence: input.confidence ?? 80,
    source: input.source ?? 'system',
    visibility: input.visibility ?? 'both',
    reviewedByAdmin: input.reviewedByAdmin ? 1 : 0,
  });
  return id;
}

export async function rememberOrderFacts(chatSessionId: string, orderId: string) {
  const [order] = await db.select().from(transaksi).where(eq(transaksi.id_transaksi, orderId)).limit(1);
  if (!order?.id_customer) return;

  const tasks: Promise<unknown>[] = [
    upsertCustomerMemory({ customerId: order.id_customer, key: 'alamat_default', value: order.alamat_penerima || 'Alamat tersimpan dari order terakhir', source: 'order', confidence: 90 }),
    upsertCustomerMemory({ customerId: order.id_customer, key: 'metode_bayar_terakhir', value: order.payment_method || 'Belum diketahui', source: 'order', confidence: 80 }),
    upsertCustomerMemory({ customerId: order.id_customer, key: 'order_terakhir', value: `${order.kode_pesanan || order.id_transaksi} • ${order.order_status}`, source: 'order', confidence: 90 }),
  ];

  const [cart] = await db.select().from(chatCarts).where(eq(chatCarts.chatSessionId, chatSessionId)).limit(1);
  if (cart) {
    const items = await db
      .select({ productName: produk.nama_produk, variantName: produkVarian.nama_varian })
      .from(chatCartItems)
      .innerJoin(produk, eq(chatCartItems.productId, produk.id_produk))
      .leftJoin(produkVarian, eq(chatCartItems.variantId, produkVarian.id_varian))
      .where(eq(chatCartItems.cartId, cart.id))
      .limit(6);

    const names = items.map((item) => item.variantName ? `${item.productName} ${item.variantName}` : item.productName).filter(Boolean);
    if (names.length > 0) {
      tasks.push(upsertCustomerMemory({ customerId: order.id_customer, key: 'produk_terakhir_dipesan', value: names.join(', '), source: 'order', confidence: 80 }));
    }
  }

  if (order.payment_method) {
    const [method] = await db.select().from(paymentMethod).where(eq(paymentMethod.type, order.payment_method as 'bank_transfer' | 'qris' | 'ewallet' | 'cod')).limit(1);
    if (method) tasks.push(upsertCustomerMemory({ customerId: order.id_customer, key: 'label_metode_bayar_terakhir', value: method.label, source: 'order', confidence: 75 }));
  }

  await Promise.allSettled(tasks);
}

export async function rememberChatSignals(chatSessionId: string, message: string) {
  const [session] = await db.select().from(chatSessions).where(eq(chatSessions.id, chatSessionId)).limit(1);
  if (!session?.customerId) return;

  const lower = message.toLowerCase();
  const tasks: Promise<unknown>[] = [];
  const preferences = [
    lower.includes('pedas') ? 'suka/bahas pedas' : null,
    lower.includes('tidak pedas') || lower.includes('ga pedas') || lower.includes('nggak pedas') ? 'preferensi tidak terlalu pedas' : null,
    lower.includes('keluarga') ? 'belanja untuk keluarga' : null,
    lower.includes('oleh') ? 'belanja untuk oleh-oleh' : null,
    lower.includes('budget') || lower.includes('hemat') ? 'sensitif budget/hemat' : null,
  ].filter(Boolean) as string[];

  if (preferences.length > 0) {
    tasks.push(upsertCustomerMemory({ customerId: session.customerId, key: 'preferensi_chat_terakhir', value: preferences.join(', '), source: 'chat', confidence: 65, reviewedByAdmin: false }));
  }

  const coordinate = message.match(/(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/);
  if (coordinate) {
    tasks.push(upsertCustomerMemory({ customerId: session.customerId, key: 'lokasi_terakhir_dikirim', value: `${coordinate[1]}, ${coordinate[2]}`, source: 'chat', confidence: 70, reviewedByAdmin: false }));
  }

  await Promise.allSettled(tasks);
}
