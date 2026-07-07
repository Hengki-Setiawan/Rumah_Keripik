'use client';

import { useEffect, useState } from 'react';
import { Plus, ShoppingBag } from 'lucide-react';
import type { ProductCardsComponent } from '@/lib/chat-v3/types';
import { formatRupiah } from '@/lib/utils';
import { getProductPlaceholder } from '@/lib/product-placeholders';

type ProductDto = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  stock: number;
  imageUrl?: string | null;
  categoryName?: string | null;
  variants: Array<{ id: string; name: string; price: number; stock: number; imageUrl?: string | null }>;
};

export function ProductCards({ component, onAction }: { component: ProductCardsComponent; onAction: (action: string, payload?: Record<string, unknown>) => void }) {
  const [products, setProducts] = useState<ProductDto[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch('/api/public/products');
        const data = await res.json();
        if (!cancelled) {
          const ids = new Set(component.productIds);
          setProducts((data.products || []).filter((product: ProductDto) => ids.has(product.id)));
        }
      } catch {
        if (!cancelled) setProducts([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [component.productIds.join('|')]);

  if (loading) return <div className="rounded-3xl bg-white p-4 text-sm font-bold text-[#735033]">Memuat produk...</div>;
  if (products.length === 0) return <div className="rounded-3xl bg-white p-4 text-sm font-bold text-[#735033]">Produk belum tersedia.</div>;

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {products.map((product) => {
        const variant = product.variants.find((item) => item.stock > 0) || product.variants[0];
        const stock = variant ? variant.stock : product.stock;
        const price = variant ? variant.price : product.price;
        const placeholder = getProductPlaceholder({ nama_produk: product.name });
        const imageUrl = variant?.imageUrl || product.imageUrl || placeholder.url;
        return (
          <article key={product.id} className="rounded-[1.4rem] border border-[#e8c98d] bg-white p-4 shadow-sm">
            <div className="mb-3 h-32 overflow-hidden rounded-[1.1rem] bg-[#ffe1aa]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imageUrl} alt={product.name} className="h-full w-full object-cover" />
            </div>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-black text-[#2a1606]">{product.name}</h3>
                <p className="mt-1 line-clamp-2 text-xs font-semibold text-[#735033]">{product.description || 'Keripik renyah pilihan Rumah Keripik.'}</p>
              </div>
              <span className="rounded-full bg-[#fff0c2] px-2 py-1 text-[10px] font-black text-[#8d4b00]">{product.categoryName || 'Produk'}</span>
            </div>
            {variant && <p className="mt-2 text-xs font-bold text-[#735033]">Varian: {variant.name}</p>}
            <div className="mt-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-lg font-black text-[#8d4b00]">{formatRupiah(price)}</p>
                <p className={`text-xs font-bold ${stock > 0 ? 'text-[#287243]' : 'text-red-600'}`}>{stock > 0 ? `Stok ${stock}` : 'Stok habis'}</p>
              </div>
              <button
                type="button"
                disabled={stock <= 0}
                onClick={() => onAction('add_to_cart', { productId: product.id, variantId: variant?.id, quantity: 1 })}
                className="inline-flex items-center gap-2 rounded-full bg-[#8d4b00] px-4 py-2 text-sm font-black text-white disabled:bg-[#c9b9a3]"
              >
                {stock > 0 ? <Plus size={15} /> : <ShoppingBag size={15} />} {stock > 0 ? 'Tambah' : 'Habis'}
              </button>
            </div>
          </article>
        );
      })}
    </div>
  );
}
