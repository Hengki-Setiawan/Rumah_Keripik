import { z } from 'zod';

// ─── Auth ────────────────────────────────────────────────────────────────────────
export const CourierLoginSchema = z.object({
  phone: z.string().min(10).max(15),
  pin: z.string().length(6),
});

export const CourierRegisterSchema = z.object({
  name: z.string().min(1).max(100),
  phone: z.string().min(10).max(15),
  pin: z.string().length(6),
  vehicle: z.enum(['motor', 'mobil']).optional(),
  plat_no: z.string().max(15).optional(),
});

export interface CourierAuthResponse {
  ok: boolean;
  token?: string;
  courier?: CourierDto;
  error?: string;
}

export interface CourierDto {
  id: number;
  name: string;
  phone: string;
  vehicle: string | null;
  plat_no: string | null;
  is_active: boolean;
}

// ─── Delivery ─────────────────────────────────────────────────────────────────────
export interface CourierDeliveryDto {
  id: number;
  id_transaksi: string;
  kode_pesanan: string;
  status: 'Siap_Dikirim' | 'Dalam_Pengiriman' | 'Terkirim' | 'Gagal';
  customer_name: string;
  customer_phone: string;
  address: string;
  latitude: string | null;
  longitude: string | null;
  distance_km: string | null;
  items: CourierDeliveryItem[];
  notes: string | null;
  route_order: number | null;
}

export interface CourierDeliveryItem {
  name: string;
  quantity: number;
  price: number;
}

export const CourierStartDeliverySchema = z.object({
  delivery_id: z.number(),
});

export const CourierCompleteDeliverySchema = z.object({
  delivery_id: z.number(),
  proof_photo_url: z.string().optional(),
  signature_url: z.string().optional(),
  signature_base64: z.string().optional(),
  notes: z.string().max(500).optional(),
});

export const CourierFailDeliverySchema = z.object({
  delivery_id: z.number(),
  reason: z.string().min(1).max(500),
  proof_photo_url: z.string().optional(),
  notes: z.string().max(500).optional(),
});

// ─── Location ────────────────────────────────────────────────────────────────────
export const CourierLocationBatchSchema = z.object({
  locations: z.array(z.object({
    lat: z.number(),
    lng: z.number(),
    accuracy: z.number().optional(),
    speed: z.number().optional(),
    timestamp: z.number(),
  })).min(1).max(100),
});

export interface CourierLocationPoint {
  lat: number;
  lng: number;
  accuracy?: number;
  speed?: number;
  timestamp: number;
}

// ─── Route ───────────────────────────────────────────────────────────────────────
export interface CourierRoutePoint {
  id_transaksi: string;
  sequence_no: number;
  latitude: number;
  longitude: number;
  address: string;
  status: 'pending' | 'visited' | 'skipped';
}
