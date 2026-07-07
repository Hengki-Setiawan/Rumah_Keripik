'use client';

import { Minus, Plus, ShoppingBag } from 'lucide-react';
import type { ChatCartDto, CartSummaryComponent } from '@/lib/chat-v3/types';
import { formatRupiah } from '@/lib/utils';

export function CartSummaryCard({ cart, onAction }: { component: CartSummaryComponent; cart?: ChatCartDto | null; onAction: (action: string, payload?: Record<string, unknown>) => void }) {
  if (!cart || cart.itemCount === 0) {
    return <div className="rounded-2xl border border-dashed border-[#d1d5db] bg-white p-5 text-sm text-[#6b7280]">Keranjang masih kosong.</div>;
  }

  return (
    <div id="chat-cart" className="rounded-2xl border border-[#e5e7eb] bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
      <div className="mb-3 flex items-center gap-2">
        <ShoppingBag className="text-[#10a37f]" size={18} />
        <h3 className="font-semibold text-[#111827]">Ringkasan keranjang</h3>
      </div>
      <div className="space-y-2">
        {cart.items.map((item) => (
          <div key={item.id} className="flex items-center justify-between gap-3 rounded-2xl bg-[#f7f7f8] p-3">
            <div className="min-w-0">
              <p className="truncate font-medium text-[#111827]">{item.productName}</p>
              {item.variantName && <p className="text-xs text-[#6b7280]">{item.variantName}</p>}
              <p className="text-xs text-[#6b7280]">{item.quantity} x {formatRupiah(item.unitPrice)}</p>
            </div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => onAction('update_cart_item', { itemId: item.id, quantity: item.quantity - 1 })} className="grid h-8 w-8 place-items-center rounded-full border border-[#e5e7eb] bg-white text-[#111827] transition hover:bg-[#f3f4f6]"><Minus size={14} /></button>
              <span className="min-w-5 text-center text-sm font-semibold">{item.quantity}</span>
              <button type="button" onClick={() => onAction('update_cart_item', { itemId: item.id, quantity: item.quantity + 1 })} className="grid h-8 w-8 place-items-center rounded-full bg-[#111827] text-white transition hover:bg-[#374151]"><Plus size={14} /></button>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-4 rounded-2xl bg-[#111827] p-4 text-white">
        <div className="flex justify-between text-sm text-white/70"><span>Total item</span><span>{cart.itemCount}</span></div>
        <div className="mt-1 flex items-end justify-between"><span className="font-medium text-white/80">Total produk</span><span className="text-2xl font-semibold tracking-[-0.03em]">{formatRupiah(cart.total)}</span></div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={() => onAction('request_location')} className="rounded-full border border-[#e5e7eb] bg-white px-4 py-2 text-sm font-medium text-[#111827] transition hover:bg-[#f3f4f6]">Isi alamat</button>
        <button type="button" onClick={() => onAction('show_payment_methods')} className="rounded-full bg-[#111827] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#374151]">Pilih pembayaran</button>
      </div>
    </div>
  );
}
