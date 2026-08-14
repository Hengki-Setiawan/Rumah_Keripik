import { z } from 'zod';

export const CourierRegisterSchema = z.object({
  name: z.string().min(1).max(100),
  phone: z.string().min(10).max(15),
  pin: z.string().length(6),
  vehicle: z.enum(['motor', 'mobil']).optional(),
  plat_no: z.string().max(15).optional(),
});

// ─── Delivery ─────────────────────────────────────────────────────────────────────
export const CourierCompleteDeliverySchema = z.object({
  delivery_id: z.number(),
  proof_photo_url: z.string().optional(),
  proof_url: z.string().optional(),
  signature_url: z.string().optional(),
  signature_base64: z.string().optional(),
  notes: z.string().max(500).optional(),
});

export const CourierFailDeliverySchema = z.object({
  delivery_id: z.number(),
  reason: z.string().min(1).max(500),
  proof_photo_url: z.string().optional(),
  proof_url: z.string().optional(),
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
