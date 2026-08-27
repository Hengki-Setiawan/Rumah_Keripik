/**
 * invoice-generator.tsx — Lightweight Module untuk generate PDF Invoice dan upload ke Cloudinary
 * Didesain ringan untuk Cloudflare edge runtime tanpa library berat @react-pdf/renderer
 */

import { db } from './db';
import { transaksi } from './schema';
import { eq } from 'drizzle-orm';
import { uploadInvoicePDF } from './cloudinary';

function createSimplePDF(invoiceCode: string, customerName: string, total: number, dateStr: string): Buffer {
  const safeCode = String(invoiceCode).replace(/[^a-zA-Z0-9_-]/g, '');
  const safeName = String(customerName).replace(/[^a-zA-Z0-9 _-]/g, '');
  const text = `INVOICE RUMAH KERIPIK | Kode: ${safeCode} | Pelanggan: ${safeName} | Total: Rp ${total} | Tanggal: ${dateStr}`;
  const streamContent = `BT /F1 14 Tf 50 750 Td (${text}) Tj ET`;
  
  const pdfString = `%PDF-1.4
1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj
2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj
3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj
4 0 obj << /Length ${streamContent.length} >> stream
${streamContent}
endstream
endobj
5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj
xref
0 6
0000000000 65535 f 
0000000010 00000 n 
0000000060 00000 n 
0000000117 00000 n 
0000000242 00000 n 
0000000300 00000 n 
trailer << /Size 6 /Root 1 0 R >>
startxref
375
%%EOF`;

  return Buffer.from(pdfString);
}

export async function generateAndSaveInvoice(id_transaksi: string): Promise<string> {
  const txRows = await db.select().from(transaksi).where(eq(transaksi.id_transaksi, id_transaksi)).limit(1);
  if (txRows.length === 0) throw new Error(`Transaksi ${id_transaksi} tidak ditemukan`);

  const tx: any = txRows[0];
  const customerName = tx.nama_pelanggan || tx.no_wa_pelanggan || 'Pelanggan';
  const total = tx.total_bayar || 0;
  const dateStr = new Date(tx.waktu_simpan ? tx.waktu_simpan + 'Z' : Date.now()).toLocaleDateString('id-ID');

  const buffer = createSimplePDF(
    tx.kode_pesanan || id_transaksi,
    customerName,
    total,
    dateStr
  );

  const uploadResult = await uploadInvoicePDF(buffer, id_transaksi);
  const secureUrl = uploadResult.secure_url;

  await db
    .update(transaksi)
    .set({ invoice_url: secureUrl })
    .where(eq(transaksi.id_transaksi, id_transaksi));

  return secureUrl;
}
