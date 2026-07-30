import { z } from 'zod';

export const courierLoginSchema = z.object({
  phone: z.string().min(10).max(15),
  pin: z.string().length(6),
  deviceInfo: z.object({
    platform: z.enum(['android', 'ios']).optional(),
    model: z.string().optional(),
  }).optional(),
});

export const courierLoginResponseSchema = z.object({
  success: z.boolean(),
  data: z.object({
    token: z.string(),
    courier: z.object({
      id: z.number(),
      name: z.string(),
      employeeCode: z.string().nullable(),
      phone: z.string(),
      photoUrl: z.string().nullable(),
      vehicle: z.enum(['motor', 'mobil']).nullable(),
      role: z.enum(['courier', 'supervisor']).default('courier'),
    }),
  }),
});

export const shiftClockInSchema = z.object({
  lat: z.string().optional(),
  lng: z.string().optional(),
});

export const shiftClockOutSchema = z.object({
  lat: z.string().optional(),
  lng: z.string().optional(),
});

export const shiftResponseSchema = z.object({
  success: z.boolean(),
  data: z.object({
    shiftId: z.number(),
    clockInAt: z.string(),
    status: z.enum(['active', 'ended', 'forced_end']),
  }),
});

export const startDeliverySchema = z.object({
  lat: z.string().optional(),
  lng: z.string().optional(),
});

export const arrivedDeliverySchema = z.object({
  lat: z.string().optional(),
  lng: z.string().optional(),
});

export const completeDeliverySchema = z.object({
  lat: z.string().optional(),
  lng: z.string().optional(),
  notes: z.string().optional(),
  codCollected: z.boolean().optional(),
  photoUrl: z.string().optional(),
});

export const failDeliverySchema = z.object({
  lat: z.string().optional(),
  lng: z.string().optional(),
  reason: z.enum([
    'penerima_tidak_ada', 'alamat_tidak_ditemukan', 'ditolak_penerima',
    'cuaca_akses_jalan', 'kendaraan_bermasalah', 'lainnya',
  ]).optional(),
  notes: z.string().optional(),
  photoUrl: z.string().optional(),
});

export const locationBatchSchema = z.object({
  points: z.array(z.object({
    lat: z.string(),
    lng: z.string(),
    accuracy: z.string().optional(),
    speed: z.string().optional(),
    heading: z.string().optional(),
    recordedAt: z.string(),
    deliveryId: z.number().optional(),
  })),
});

export const incidentSchema = z.object({
  type: z.enum(['kecelakaan', 'kendaraan_mogok', 'cuaca_ekstrem', 'keamanan', 'kesehatan', 'lainnya']),
  severity: z.enum(['low', 'medium', 'high', 'emergency']).default('medium'),
  description: z.string().optional(),
  lat: z.string().optional(),
  lng: z.string().optional(),
  deliveryId: z.number().optional(),
  photoUrl: z.string().optional(),
});

export const pushTokenSchema = z.object({
  expoPushToken: z.string(),
  deviceInfo: z.object({
    platform: z.enum(['android', 'ios']).optional(),
    model: z.string().optional(),
  }).optional(),
});

export const deviceBindSchema = z.object({
  action: z.enum(['bind', 'unbind', 'verify']),
  deviceId: z.string(),
});

export const offerRespondSchema = z.object({
  assignmentId: z.number(),
  action: z.enum(['accept', 'reject']),
});

export const apiResponseSchema = <T extends z.ZodTypeAny>(dataSchema: T) => z.object({
  success: z.boolean(),
  data: dataSchema.optional(),
  error: z.object({
    code: z.string(),
    message: z.string(),
  }).optional(),
});

export type CourierLoginInput = z.infer<typeof courierLoginSchema>;
export type ShiftClockInInput = z.infer<typeof shiftClockInSchema>;
export type ShiftClockOutInput = z.infer<typeof shiftClockOutSchema>;
export type CompleteDeliveryInput = z.infer<typeof completeDeliverySchema>;
export type FailDeliveryInput = z.infer<typeof failDeliverySchema>;
export type LocationBatchInput = z.infer<typeof locationBatchSchema>;
export type IncidentInput = z.infer<typeof incidentSchema>;
export type PushTokenInput = z.infer<typeof pushTokenSchema>;
export type DeviceBindInput = z.infer<typeof deviceBindSchema>;
export type OfferRespondInput = z.infer<typeof offerRespondSchema>;
