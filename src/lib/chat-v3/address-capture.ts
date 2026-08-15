import { eq, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { customerAddress, customerProfile } from '@/lib/schema';

export type CapturedAddress = {
  text: string;
  lat?: string | null;
  lng?: string | null;
};

/**
 * Parsing alamat yang dikirim lewat chat.
 * Mendukung: "Lokasi saya: -6.2, 106.8", "Alamat saya: Jl ...", dan "lat, lng" polos.
 */
export function parseCapturedAddress(message: string): CapturedAddress | null {
  const trimmed = message.trim();

  const locationMatch = trimmed.match(/^lokasi\s*(?:saya)?\s*[:=]?\s*(-?\d{1,3}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)\s*$/i);
  if (locationMatch) {
    return { text: `Lokasi kirim: ${locationMatch[1]}, ${locationMatch[2]}`, lat: locationMatch[1], lng: locationMatch[2] };
  }

  const addressMatch = trimmed.match(/^alamat\s*(?:saya)?\s*[:=]?\s*(.+)$/i);
  if (addressMatch && addressMatch[1].trim().length >= 8) {
    return { text: addressMatch[1].trim() };
  }

  const rawMatch = trimmed.match(/^(-?\d{1,3}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)$/);
  if (rawMatch) {
    return { text: `Lokasi kirim: ${rawMatch[1]}, ${rawMatch[2]}`, lat: rawMatch[1], lng: rawMatch[2] };
  }

  return null;
}

/**
 * Simpan alamat hasil capture ke akun customer (sebagai alamat default baru).
 * Mengambil nama & nomor WA asli dari customerProfile agar data penerima lengkap.
 */
export async function saveCapturedAddress(customerId: string, captured: CapturedAddress) {
  const [profile] = await db
    .select({ nama: customerProfile.nama, phone: customerProfile.phone })
    .from(customerProfile)
    .where(eq(customerProfile.id_customer, customerId))
    .limit(1);

  const recipientName = profile?.nama || 'Customer';
  const phone = profile?.phone || null;
  const hasCoords = Boolean(captured.lat && captured.lng);

  await db.transaction(async (tx) => {
    await tx.update(customerAddress).set({ is_default: 0, updated_at: sql`(datetime('now', 'utc'))` }).where(eq(customerAddress.id_customer, customerId));

    const [row] = await tx
      .insert(customerAddress)
      .values({
        id_customer: customerId,
        label: 'Alamat utama',
        recipient_name: recipientName,
        phone,
        address_text: captured.text,
        latitude: captured.lat || null,
        longitude: captured.lng || null,
        location_source: hasCoords ? ('map_picker' as const) : ('manual' as const),
        landmark: null,
        courier_note: null,
        is_default: 1,
        last_used_at: sql`(datetime('now', 'utc'))`,
        updated_at: sql`(datetime('now', 'utc'))`,
      })
      .returning({ id_address: customerAddress.id_address });

    return row?.id_address ?? null;
  });
}