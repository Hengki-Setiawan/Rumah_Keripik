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
    <aside className="flex h-full flex-col border-r border-[#e8dcc9] bg-[linear-gradient(180deg,#fff9f1_0%,#f6efe4_100%)] p-3 text-[#2f241c]">
      <div className="mb-4 rounded-[1.4rem] border border-[#e8dcc9] bg-[#fffdf8] px-3 py-3 shadow-[0_10px_24px_rgba(47,36,28,0.05)]">
        <div className="flex items-center gap-3">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-[#6b4423] text-sm font-semibold text-white shadow-[0_10px_24px_rgba(107,68,35,0.16)]">RK</div>
          <div>
            <p className="text-sm font-semibold tracking-[0.12em] text-[#2f241c]">RUMAH KERIPIK</p>
            <p className="text-xs text-[#6b5a4d]">Asisten pemesanan</p>
          </div>
        </div>
      </div>

      <div className="grid gap-1.5 text-sm font-medium">
        <button onClick={onNewOrder} className="flex items-center gap-2 rounded-xl border border-[#e8dcc9] bg-[#fffdf8] px-3 py-2.5 text-left text-[#2f241c] shadow-[0_6px_18px_rgba(47,36,28,0.04)] transition hover:bg-[#f3ebdc] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6b4423]/20">
          <MessageSquarePlus size={17} /> Pesanan Baru
        </button>
        <a href="/pesan/lacak" className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-[#5a4a3c] transition hover:bg-[#f3ebdc] hover:text-[#2f241c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6b4423]/20">
          <PackageSearch size={17} /> Lacak Pesanan
        </a>
        <a href="#chat-cart" className="flex items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-[#5a4a3c] transition hover:bg-[#f3ebdc] hover:text-[#2f241c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6b4423]/20">
          <span className="flex items-center gap-2"><ShoppingBag size={17} /> Keranjang</span>
          <span className="rounded-full bg-[#6b4423] px-2 py-0.5 text-xs text-white">{cartCount}</span>
        </a>
        <a href="#bantuan" className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-[#5a4a3c] transition hover:bg-[#f3ebdc] hover:text-[#2f241c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6b4423]/20">
          <LifeBuoy size={17} /> Bantuan
        </a>
      </div>

      <div className="mt-6 min-h-0 flex-1 overflow-y-auto">
        <p className="mb-2 px-2 text-xs font-medium uppercase tracking-[0.16em] text-[#a08973]">Riwayat chat</p>
        <div className="space-y-2">
          {sessions.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-[#d9ccb9] bg-[#fffdf8] p-4 text-sm text-[#6b5a4d]">Belum ada riwayat lain.</p>
          ) : sessions.map((session) => (
            <div key={session.id} className={`rounded-xl px-3 py-2.5 text-sm transition ${activeId === session.id ? 'border border-[#e8dcc9] bg-[#efe4d3] text-[#2f241c]' : 'text-[#5a4a3c] hover:bg-[#f3ebdc]'}`}>
              <p className="truncate font-medium">{session.title || 'Pesanan Baru'}</p>
              <p className="mt-1 text-xs text-[#a08973]">{session.status}</p>
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}
