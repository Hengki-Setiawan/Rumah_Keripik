'use client';

import { Minus, Plus, ShoppingBag } from 'lucide-react';
import type { ChatCartDto, CartSummaryComponent } from '@/lib/chat-v3/types';
import { formatRupiah } from '@/lib/utils';

export function CartSummaryCard({ component: _component, cart, onAction }: { component: CartSummaryComponent; cart?: ChatCartDto | null; onAction: (action: string, payload?: Record<string, unknown>) => void }) {
  if (!cart || cart.itemCount === 0) {
    return <div className="rounded-3xl border border-dashed border-[#d7b276] bg-white p-5 text-sm font-bold text-[#735033]">Keranjang masih kosong.</div>;
  }

  return (
    <div id="chat-cart" className="rounded-[1.4rem] border border-[#e8c98d] bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        <ShoppingBag className="text-[#8d4b00]" size={18} />
        <h3 className="font-black text-[#2a1606]">Ringkasan Keranjang</h3>
      </div>
      <div className="space-y-2">
        {cart.items.map((item) => (
          <div key={item.id} className="flex items-center justify-between gap-3 rounded-2xl bg-[#fff8e8] p-3">
            <div className="min-w-0">
              <p className="truncate font-black text-[#2a1606]">{item.productName}</p>
              {item.variantName && <p className="text-xs font-bold text-[#735033]">{item.variantName}</p>}
              <p className="text-xs font-bold text-[#735033]">{item.quantity} × {formatRupiah(item.unitPrice)}</p>
            </div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => onAction('update_cart_item', { itemId: item.id, quantity: item.quantity - 1 })} className="grid h-8 w-8 place-items-center rounded-full bg-white text-[#8d4b00]"><Minus size={14} /></button>
              <span className="min-w-5 text-center text-sm font-black">{item.quantity}</span>
              <button type="button" onClick={() => onAction('update_cart_item', { itemId: item.id, quantity: item.quantity + 1 })} className="grid h-8 w-8 place-items-center rounded-full bg-[#2a1606] text-white"><Plus size={14} /></button>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-4 rounded-2xl bg-[#2a1606] p-4 text-white">
        <div className="flex justify-between text-sm font-bold text-white/70"><span>Total item</span><span>{cart.itemCount}</span></div>
        <div className="mt-1 flex items-end justify-between"><span className="font-bold text-white/80">Total produk</span><span className="text-2xl font-black">{formatRupiah(cart.total)}</span></div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={() => onAction('request_location')} className="rounded-full bg-[#123524] px-4 py-2 text-sm font-black text-white">Isi alamat</button>
        <button type="button" onClick={() => onAction('show_payment_methods')} className="rounded-full bg-[#8d4b00] px-4 py-2 text-sm font-black text-white">Pilih pembayaran</button>
      </div>
    </div>
  );
}
