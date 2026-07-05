import { and, asc, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { botMenuItem, paymentMethod, produk, produkKategori, produkVarian } from '@/lib/schema';
import { WebOrderApp } from '@/components/order/WebOrderApp';
import { EventOrderPanel } from '@/components/order/EventOrderPanel';
import { getProductImageUrl } from '@/lib/cloudinary-url';

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
      image_url: produk.image_url,
      cloudinary_public_id: produk.cloudinary_public_id,
      kategori_id: produk.kategori_id,
      kategori_nama: produkKategori.nama_kategori,
    })
    .from(produk)
    .leftJoin(produkKategori, eq(produk.kategori_id, produkKategori.id_kategori))
    .where(eq(produk.is_active, 1))
    .orderBy(asc(produk.nama_produk));

  const [categories, variants, paymentMethods, menuItems] = await Promise.all([
    db.select({ id: produkKategori.id_kategori, name: produkKategori.nama_kategori }).from(produkKategori).where(eq(produkKategori.is_active, 1)).orderBy(asc(produkKategori.sort_order), asc(produkKategori.nama_kategori)),
    db.select({ id_varian: produkVarian.id_varian, id_produk: produkVarian.id_produk, nama_varian: produkVarian.nama_varian, harga_jual: produkVarian.harga_jual, stok: produkVarian.stok, image_url: produkVarian.image_url, cloudinary_public_id: produkVarian.cloudinary_public_id }).from(produkVarian).where(eq(produkVarian.is_active, 1)).orderBy(asc(produkVarian.sort_order), asc(produkVarian.nama_varian)),
    db.select().from(paymentMethod).where(eq(paymentMethod.is_active, 1)).orderBy(asc(paymentMethod.sort_order), asc(paymentMethod.label)),
    db.select({ label: botMenuItem.label }).from(botMenuItem).where(and(eq(botMenuItem.is_active, 1), eq(botMenuItem.surface, 'public_ordering'))).orderBy(asc(botMenuItem.sort_order)).limit(8),
  ]);
  const variantsByProduct = new Map<string, typeof variants>();
  for (const variant of variants) {
    const list = variantsByProduct.get(variant.id_produk) || [];
    list.push(variant);
    variantsByProduct.set(variant.id_produk, list);
  }

  const mappedProducts = products.map((product) => ({
        ...product,
        image_url: product.cloudinary_public_id ? getProductImageUrl(product.cloudinary_public_id) : product.image_url,
        kategori_id: product.kategori_id,
        kategori_nama: product.kategori_nama,
        variants: (variantsByProduct.get(product.id_produk) || []).map((variant) => ({
          id_varian: variant.id_varian,
          nama_varian: variant.nama_varian,
          harga_jual: variant.harga_jual,
          stok: variant.stok,
          image_url: variant.cloudinary_public_id ? getProductImageUrl(variant.cloudinary_public_id) : variant.image_url,
        })),
      }));
  const mappedPaymentMethods = paymentMethods.map((method) => ({
        id: method.id_payment_method,
        type: method.type,
        label: method.label,
        accountName: method.account_name,
        accountNumber: method.account_number,
        bankName: method.bank_name,
        qrisImageUrl: method.qris_image_url,
        note: method.note,
        minOrderTotal: method.min_order_total,
        maxOrderTotal: method.max_order_total,
      }));

  return (
    <>
      <WebOrderApp
        products={mappedProducts}
        categories={categories}
        paymentMethods={mappedPaymentMethods}
        quickPrompts={menuItems.map((item) => item.label).filter(Boolean)}
        source={params?.source}
        chatId={params?.chatId}
      />
      <div className="bg-[#fff7df] px-5 pb-12 md:px-10 lg:px-16">
        <div className="mx-auto max-w-7xl">
          <EventOrderPanel />
        </div>
      </div>
    </>
  );
}
