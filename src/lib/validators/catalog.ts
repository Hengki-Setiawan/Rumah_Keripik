import { z } from 'zod';

export const CategorySchema = z.object({
  id_kategori: z.string().min(1).optional(),
  nama_kategori: z.string().min(1, 'Nama kategori wajib diisi').max(80),
  slug: z.string().min(1).max(100).optional(),
  deskripsi: z.string().max(500).optional().nullable(),
  sort_order: z.number().int().min(0).default(0),
  is_active: z.number().int().min(0).max(1).default(1),
});

export const VariantSchema = z.object({
  id_varian: z.string().min(1).optional(),
  id_produk: z.string().min(1, 'Produk wajib dipilih'),
  sku: z.string().max(80).optional().nullable(),
  nama_varian: z.string().min(1, 'Nama varian wajib diisi').max(120),
  rasa: z.string().max(80).optional().nullable(),
  ukuran: z.string().max(80).optional().nullable(),
  berat_gram: z.number().int().min(0).optional().nullable(),
  harga_jual: z.number().int().min(1000, 'Harga minimal Rp1.000'),
  stok: z.number().int().min(0, 'Stok tidak boleh negatif'),
  cloudinary_public_id: z.string().max(255).optional().nullable(),
  image_url: z.string().max(1000).optional().nullable(),
  is_active: z.number().int().min(0).max(1).default(1),
  sort_order: z.number().int().min(0).default(0),
});

export const ProductMediaSchema = z.object({
  id_produk: z.string().min(1, 'Produk wajib dipilih'),
  id_varian: z.string().min(1).optional().nullable(),
  cloudinary_public_id: z.string().min(1, 'Cloudinary public ID wajib diisi'),
  secure_url: z.string().url().optional().nullable(),
  media_type: z.enum(['image', 'video']).default('image'),
  alt_text: z.string().max(160).optional().nullable(),
  sort_order: z.number().int().min(0).default(0),
  is_primary: z.number().int().min(0).max(1).default(0),
});

export type CategoryInput = z.infer<typeof CategorySchema>;
export type VariantInput = z.infer<typeof VariantSchema>;
export type ProductMediaInput = z.infer<typeof ProductMediaSchema>;
