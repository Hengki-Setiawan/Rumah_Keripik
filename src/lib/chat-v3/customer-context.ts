import { desc, eq, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { chatSessions, customerAddress, customerProfile, customerSessions, transaksi } from '@/lib/schema';
import { getCustomerMemory } from './memory';
import type { AddressSummary, CustomerContextDto, MaskedCustomerSummary } from './types';

function parseTags(value: string | null) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

export function maskPhone(phone?: string | null) {
  if (!phone) return null;
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length <= 4) return '****';
  return `${'*'.repeat(Math.max(4, cleaned.length - 4))}${cleaned.slice(-4)}`;
}

export function summarizeAddress(address?: string | null) {
  if (!address) return 'Alamat tersimpan';
  const trimmed = address.replace(/\s+/g, ' ').trim();
  if (trimmed.length <= 96) return trimmed;
  return `${trimmed.slice(0, 72)}... ${trimmed.slice(-18)}`;
}

function toMaskedCustomer(row: typeof customerProfile.$inferSelect): MaskedCustomerSummary {
  return {
    id: row.id_customer,
    name: row.nama,
    phoneMasked: maskPhone(row.phone),
    tags: parseTags(row.tags_json),
  };
}

function toAddressSummary(row: typeof customerAddress.$inferSelect): AddressSummary {
  return {
    id: row.id_address,
    label: row.label,
    recipientName: row.recipient_name,
    phoneMasked: maskPhone(row.phone),
    addressSummary: summarizeAddress(row.address_text),
    latitude: row.latitude,
    longitude: row.longitude,
    isDefault: Boolean(row.is_default),
  };
}

export async function getCustomerContextForChat(chatSessionId: string): Promise<CustomerContextDto> {
  const [chatSession] = await db.select().from(chatSessions).where(eq(chatSessions.id, chatSessionId)).limit(1);
  if (!chatSession) return { customer: null, addresses: [], defaultAddress: null, memory: [], lastOrder: null };

  let customerId = chatSession.customerId;
  if (!customerId) {
    const [session] = await db.select().from(customerSessions).where(eq(customerSessions.id, chatSession.customerSessionId)).limit(1);
    customerId = session?.customerId || null;
  }

  if (!customerId) return { customer: null, addresses: [], defaultAddress: null, memory: [], lastOrder: null };

  const [customer, addresses, memory, lastOrders] = await Promise.all([
    db.select().from(customerProfile).where(eq(customerProfile.id_customer, customerId)).limit(1).then((rows) => rows[0]),
    db.select().from(customerAddress).where(eq(customerAddress.id_customer, customerId)).orderBy(desc(customerAddress.is_default), desc(customerAddress.last_used_at)).limit(5),
    getCustomerMemory(customerId, 10),
    db.select().from(transaksi).where(eq(transaksi.id_customer, customerId)).orderBy(desc(transaksi.waktu_simpan)).limit(1),
  ]);

  const addressSummaries = addresses.map(toAddressSummary);
  const defaultAddress = addressSummaries.find((address) => address.isDefault) || addressSummaries[0] || null;
  const lastOrder = lastOrders[0]
    ? {
        id: lastOrders[0].id_transaksi,
        code: lastOrders[0].kode_pesanan,
        status: lastOrders[0].order_status,
        paymentStatus: lastOrders[0].payment_status,
        totalAmount: lastOrders[0].total_bayar,
      }
    : null;

  return {
    customer: customer ? toMaskedCustomer(customer) : null,
    addresses: addressSummaries,
    defaultAddress,
    memory,
    lastOrder,
  };
}

export async function linkChatSessionToCustomer(chatSessionId: string, customerId: string) {
  const [chatSession] = await db.select().from(chatSessions).where(eq(chatSessions.id, chatSessionId)).limit(1);
  if (!chatSession) return;
  await Promise.all([
    db.update(chatSessions).set({ customerId, updatedAt: sql`(datetime('now', 'utc'))` }).where(eq(chatSessions.id, chatSessionId)),
    db.update(customerSessions).set({ customerId, lastSeenAt: sql`(datetime('now', 'utc'))` }).where(eq(customerSessions.id, chatSession.customerSessionId)),
  ]);
}

export async function buildReturningCustomerComponents(chatSessionId: string) {
  const context = await getCustomerContextForChat(chatSessionId);
  if (!context.customer) return [];
  return [
    { type: 'customer_confirm' as const, customerId: context.customer.id, maskedFields: true as const, customer: context.customer, actions: ['use_saved_data', 'edit_data', 'send_new_location'] },
    ...(context.defaultAddress ? [{ type: 'address_confirm' as const, addressId: context.defaultAddress.id, address: context.defaultAddress, actions: ['use_saved_address', 'edit_address', 'send_new_location'] }] : []),
  ];
}
