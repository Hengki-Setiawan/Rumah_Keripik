import { db } from './db';
import { produk, transaksi, warungRetail } from './schema';
import { desc, like } from 'drizzle-orm';
import { randomUUID } from 'crypto';

const MAX_ID_RETRIES = 5;

export async function generateIdProduk(): Promise<string> {
  for (let attempt = 0; attempt < MAX_ID_RETRIES; attempt++) {
    const lastProduk = await db
      .select({ id: produk.id_produk })
      .from(produk)
      .orderBy(desc(produk.id_produk))
      .limit(1);

    if (lastProduk.length === 0) return 'KRP-001';

    const lastNum = parseInt(lastProduk[0].id.split('-')[1]);
    return `KRP-${String(lastNum + 1).padStart(3, '0')}`;
  }
  throw new Error('Gagal generate ID Produk');
}

export async function generateIdWarung(): Promise<string> {
  const lastWarung = await db
    .select({ id: warungRetail.id_warung })
    .from(warungRetail)
    .orderBy(desc(warungRetail.id_warung))
    .limit(1);

  if (lastWarung.length === 0) return 'WRG-001';
  const lastNum = parseInt(lastWarung[0].id.split('-')[1]);
  return `WRG-${String(lastNum + 1).padStart(3, '0')}`;
}

export async function generateIdTransaksi(): Promise<string> {
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const prefix = `TX-${today}-`;

  const todayTx = await db
    .select({ id: transaksi.id_transaksi })
    .from(transaksi)
    .where(like(transaksi.id_transaksi, `${prefix}%`))
    .orderBy(desc(transaksi.id_transaksi))
    .limit(1);

  if (todayTx.length === 0) return `${prefix}001`;
  const lastNum = parseInt(todayTx[0].id.split('-')[2]);
  return `${prefix}${String(lastNum + 1).padStart(3, '0')}`;
}

export function generateKodePesanan(): string {
  const num = Math.floor(100000 + Math.random() * 900000);
  return `PESANAN-${num}`;
}

export function generateIdCustomer(): string {
  return `CUS-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${randomUUID().slice(0, 8).toUpperCase()}`;
}

export function generateIdWebSession(): string {
  return `WOS-${randomUUID()}`;
}

export function generateAnonymousToken(): string {
  return randomUUID().replace(/-/g, '');
}

export function generateOrderStatusToken(): string {
  return randomUUID().replace(/-/g, '');
}

export function generateIdPaymentProof(): string {
  return `PAY-${randomUUID()}`;
}
