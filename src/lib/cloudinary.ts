/**
 * cloudinary.ts — Utility untuk upload file ke Cloudinary
 * Digunakan untuk bukti bayar (gambar) dan invoice (PDF)
 */

import { v2 as cloudinary } from 'cloudinary';

// Konfigurasi otomatis dari env
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

export interface UploadResult {
  url: string;
  public_id: string;
  secure_url: string;
  bytes: number;
  format: string;
}

/**
 * Upload gambar bukti bayar (base64) ke Cloudinary
 */
export async function uploadBuktiBayar(
  base64: string,
  id_transaksi: string,
  mimetype: string = 'image/jpeg',
): Promise<UploadResult> {
  const ext = mimetype.includes('png') ? 'png' : 'jpg';
  const dataUri = `data:${mimetype};base64,${base64}`;

  const result = await cloudinary.uploader.upload(dataUri, {
    folder: 'rumah-keripik/bukti-bayar',
    public_id: `${id_transaksi}_${Date.now()}`,
    resource_type: 'image',
    format: ext,
    // Kompresi otomatis untuk hemat storage
    transformation: [
      { quality: 'auto:good', fetch_format: 'auto' },
    ],
    tags: ['bukti-bayar', id_transaksi],
  });

  return {
    url: result.url,
    public_id: result.public_id,
    secure_url: result.secure_url,
    bytes: result.bytes,
    format: result.format,
  };
}

/**
 * Upload PDF invoice (Buffer) ke Cloudinary
 */
export async function uploadInvoicePDF(
  pdfBuffer: Buffer,
  id_transaksi: string,
): Promise<UploadResult> {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: 'rumah-keripik/invoices',
        public_id: `invoice_${id_transaksi}`,
        resource_type: 'raw',
        format: 'pdf',
        tags: ['invoice', id_transaksi],
      },
      (error, result) => {
        if (error || !result) {
          reject(error || new Error('Upload failed'));
          return;
        }
        resolve({
          url: result.url,
          public_id: result.public_id,
          secure_url: result.secure_url,
          bytes: result.bytes,
          format: result.format,
        });
      },
    );
    uploadStream.end(pdfBuffer);
  });
}

/**
 * Hapus file dari Cloudinary (opsional, untuk cleanup)
 */
export async function deleteFromCloudinary(
  public_id: string,
  resource_type: 'image' | 'raw' = 'image',
): Promise<void> {
  await cloudinary.uploader.destroy(public_id, { resource_type });
}
