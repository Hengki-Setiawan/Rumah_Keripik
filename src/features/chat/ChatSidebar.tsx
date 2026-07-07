'use client';

import { LifeBuoy, MessageSquarePlus, PackageSearch, ShoppingBag } from 'lucide-react';

export type ChatSessionSummary = {
  id: string;
  title: string | null;
  status: string;
  updatedAt: string;
};

export function ChatSidebar({ sessions, activeId, cartCount, onNewOrder }: { sessions: ChatSessionSummary[]; activeId?: string; cartCount: number; onNewOrder?: () => void }) {
  return (
    <aside className="flex h-full flex-col border-r border-[#e5e7eb] bg-[#f7f7f8] p-3 text-[#111827]">
      <div className="mb-4 flex items-center gap-3 px-2 py-2">
        <div className="grid h-9 w-9 place-items-center rounded-xl bg-[#111827] text-sm font-semibold text-white">RK</div>
        <div>
          <p className="text-sm font-semibold tracking-[-0.01em] text-[#111827]">Rumah Keripik</p>
          <p className="text-xs text-[#6b7280]">Asisten pemesanan</p>
        </div>
      </div>

      <div className="grid gap-1.5 text-sm font-medium">
        <button onClick={onNewOrder} className="flex items-center gap-2 rounded-xl border border-[#e5e7eb] bg-white px-3 py-2.5 text-left text-[#111827] shadow-[0_1px_2px_rgba(0,0,0,0.03)] transition hover:bg-[#f3f4f6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#111827]/20">
          <MessageSquarePlus size={17} /> Pesanan Baru
        </button>
        <a href="/pesan/lacak" className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-[#4b5563] transition hover:bg-[#eceef0] hover:text-[#111827] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#111827]/20">
          <PackageSearch size={17} /> Lacak Pesanan
        </a>
        <a href="#chat-cart" className="flex items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-[#4b5563] transition hover:bg-[#eceef0] hover:text-[#111827] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#111827]/20">
          <span className="flex items-center gap-2"><ShoppingBag size={17} /> Keranjang</span>
          <span className="rounded-full bg-[#111827] px-2 py-0.5 text-xs text-white">{cartCount}</span>
        </a>
        <a href="#bantuan" className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-[#4b5563] transition hover:bg-[#eceef0] hover:text-[#111827] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#111827]/20">
          <LifeBuoy size={17} /> Bantuan
        </a>
      </div>

      <div className="mt-6 min-h-0 flex-1 overflow-y-auto">
        <p className="mb-2 px-2 text-xs font-medium text-[#9ca3af]">Riwayat chat</p>
        <div className="space-y-2">
          {sessions.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-[#d1d5db] p-4 text-sm text-[#6b7280]">Belum ada riwayat lain.</p>
          ) : sessions.map((session) => (
            <div key={session.id} className={`rounded-xl px-3 py-2.5 text-sm transition ${activeId === session.id ? 'bg-[#eceef0] text-[#111827]' : 'text-[#4b5563] hover:bg-[#eceef0]'}`}>
              <p className="truncate font-medium">{session.title || 'Pesanan Baru'}</p>
              <p className="mt-1 text-xs text-[#9ca3af]">{session.status}</p>
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}
