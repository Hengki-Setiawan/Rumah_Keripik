import { db } from './db';
import { lokasiPelanggan, pelangganChatbot } from './schema';
import { eq, sql } from 'drizzle-orm';
import { calculateDistance, buildMapsLink } from './location-parser';
import { reverseGeocode } from './geocoding';
import type { OrderContext } from './order-types';

const GUDANG_LAT = -0.5022;
const GUDANG_LNG = 117.1536;

export interface LocationInput {
  lat: number;
  lng: number;
  address?: string;
  source?: 'wa_native' | 'wa_live' | 'maps_link' | 'maps_short' | 'geocoded' | 'manual';
}

export async function processLocationMessage(
  no_wa: string,
  location: LocationInput,
  ctx: OrderContext,
): Promise<{ response: string; newContext: OrderContext }> {
  const { lat, lng } = location;

  let address = location.address;
  if (!address) {
    address = await reverseGeocode(lat, lng) || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  }

  const mapsLink = buildMapsLink(lat, lng);
  const jarak = calculateDistance(GUDANG_LAT, GUDANG_LNG, lat, lng);

  await saveLocationToDB(no_wa, { lat, lng, address, source: location.source || 'wa_native' });

  if (ctx.step === 'FORM_ALAMAT') {
    const newContext: OrderContext = {
      ...ctx,
      alamat_pengiriman: address,
      lat_pengiriman: String(lat),
      lng_pengiriman: String(lng),
      maps_link_pengiriman: mapsLink,
      jarak_km: Math.round(jarak * 10) / 10,
      step: 'CONFIRM_ALAMAT',
      last_updated: new Date().toISOString(),
    };

    return {
      response:
        `📍 *Lokasi diterima!*\n\n` +
        `Alamat terdeteksi: *${address}*\n` +
        `🔗 ${mapsLink}\n\n` +
        `Apakah alamat pengiriman ke sini kak? Ketik *ya* untuk konfirmasi.`,
      newContext,
    };
  }

  return {
    response:
      `📍 *Lokasi diterima!*\n\n` +
      `Alamat: ${address}\n` +
      `Jarak dari gudang: ±${jarak.toFixed(1)} km\n\n` +
      `Mau langsung pesan kak? Ketik *pesan* untuk mulai.`,
    newContext: ctx,
  };
}

async function saveLocationToDB(
  no_wa: string,
  location: { lat: number; lng: number; address?: string; source?: string },
) {
  try {
    await db.insert(lokasiPelanggan).values({
      no_wa_pelanggan: no_wa,
      lat: String(location.lat),
      lng: String(location.lng),
      alamat_teks: location.address || null,
      source: (location.source as any) || 'wa_native',
    });
  } catch (err) {
    console.warn('[LocationFlow] Gagal simpan lokasi:', err);
  }
}
