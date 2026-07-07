import { desc, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { chatSessions, customerAddress, customerProfile } from '@/lib/schema';
import { normalizePhoneNumber } from '@/lib/utils';

export async function getSavedCheckoutData(chatSessionId: string, addressId?: number) {
  const [session] = await db.select().from(chatSessions).where(eq(chatSessions.id, chatSessionId)).limit(1);
  if (!session?.customerId) throw new Error('Customer tersimpan belum terhubung');

  const [customer] = await db.select().from(customerProfile).where(eq(customerProfile.id_customer, session.customerId)).limit(1);
  if (!customer) throw new Error('Data customer tersimpan tidak ditemukan');

  const addressRows = addressId
    ? await db.select().from(customerAddress).where(eq(customerAddress.id_address, addressId)).limit(1)
    : await db.select().from(customerAddress).where(eq(customerAddress.id_customer, session.customerId)).orderBy(desc(customerAddress.is_default), desc(customerAddress.last_used_at)).limit(1);
  const address = addressRows[0];
  if (!address || address.id_customer !== session.customerId) throw new Error('Alamat tersimpan tidak ditemukan');

  const name = address.recipient_name || customer.nama || 'Customer Rumah Keripik';
  const phone = normalizePhoneNumber(address.phone || customer.phone || '');
  if (!phone) throw new Error('Nomor WA tersimpan belum tersedia');

  return {
    customer: { name, phone, type: 'konsumen' as const },
    address: {
      text: address.address_text,
      note: address.courier_note || address.landmark || undefined,
      lat: address.latitude || undefined,
      lng: address.longitude || undefined,
    },
  };
}
