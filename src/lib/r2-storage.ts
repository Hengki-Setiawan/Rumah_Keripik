/**
 * Cloudflare R2 Storage Client
 * Digunakan untuk menyimpan foto bukti pengiriman kurir, invoice PDF, dan gambar produk
 * Keuntungan: 10 GB gratis selamanya, 0 Rupiah Egress Bandwidth Fee!
 */

export interface R2UploadResult {
  key: string;
  url: string;
  sizeBytes: number;
  contentType: string;
  storage: 'cloudflare-r2' | 'fallback-local';
}

/**
 * Upload buffer file ke Cloudflare R2 Bucket
 */
export async function uploadToR2(
  fileBuffer: Uint8Array | Buffer,
  key: string,
  contentType: string = 'application/octet-stream'
): Promise<R2UploadResult> {
  // 1. Coba upload via Cloudflare Native R2 Bucket Binding
  try {
    const { getCloudflareContext } = await import('@opennextjs/cloudflare');
    const ctx = await getCloudflareContext({ async: true });
    
    // Cari binding R2 yang tersedia di env
    const r2Bucket = (ctx?.env as any)?.R2_STORAGE || (ctx?.env as any)?.NEXT_INC_CACHE_R2_BUCKET;
    if (r2Bucket && typeof r2Bucket.put === 'function') {
      await r2Bucket.put(key, fileBuffer, {
        httpMetadata: { contentType },
      });

      const publicDomain = process.env.R2_PUBLIC_DOMAIN || 'https://r2.rumah-keripik.pages.dev';
      const url = `${publicDomain}/${key}`;

      return {
        key,
        url,
        sizeBytes: fileBuffer.byteLength,
        contentType,
        storage: 'cloudflare-r2',
      };
    }
  } catch (bindingError) {
    // Di lokal tanpa wrangler, lanjut ke fallback
  }

  // 2. Jika tidak ada binding R2 (misal local dev), kembalikan base64 data URI atau placeholder
  const base64 = Buffer.from(fileBuffer).toString('base64');
  return {
    key,
    url: `data:${contentType};base64,${base64}`,
    sizeBytes: fileBuffer.byteLength,
    contentType,
    storage: 'fallback-local',
  };
}
