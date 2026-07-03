import { asc, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { produk } from '@/lib/schema';
import { WebOrderApp } from '@/components/order/WebOrderApp';

export const dynamic = 'force-dynamic';

type PageProps = {
  searchParams?: Promise<{
    source?: string;
    chatId?: string;
  }>;
};

export default async function PesanPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const products = await db
    .select({
      id_produk: produk.id_produk,
      nama_produk: produk.nama_produk,
      deskripsi: produk.deskripsi,
      harga_jual: produk.harga_jual,
      stok_gudang_utama: produk.stok_gudang_utama,
    })
    .from(produk)
    .where(eq(produk.is_active, 1))
    .orderBy(asc(produk.nama_produk));

  return (
    <WebOrderApp
      products={products}
      source={params?.source}
      chatId={params?.chatId}
    />
  );
}
