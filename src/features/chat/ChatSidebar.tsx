'use client';

import { MessageSquarePlus, PackageSearch, ShoppingBag, LifeBuoy } from 'lucide-react';

export type ChatSessionSummary = {
  id: string;
  title: string | null;
  status: string;
  updatedAt: string;
};

export function ChatSidebar({ sessions, activeId, cartCount }: { sessions: ChatSessionSummary[]; activeId?: string; cartCount: number }) {
  return (
    <aside className="flex h-full flex-col border-r border-[#e7c88c] bg-[#fff8e8]/95 p-4 text-[#2a1606]">
      <div className="mb-5 flex items-center gap-3 rounded-3xl bg-[#2a1606] p-3 text-white shadow-lg shadow-[#2a1606]/15">
        <div className="grid h-11 w-11 place-items-center rounded-2xl bg-[#ffd98a] font-black text-[#2a1606]">RK</div>
        <div>
          <p className="text-sm font-black uppercase tracking-[0.18em] text-[#ffd98a]">Rumah Keripik</p>
          <p className="text-xs font-bold text-white/75">AI Commerce Assistant</p>
        </div>
      </div>

      <div className="grid gap-2 text-sm font-black">
        <button className="flex items-center gap-2 rounded-2xl bg-white px-4 py-3 text-left shadow-sm">
          <MessageSquarePlus size={17} /> Pesanan Baru
        </button>
        <a href="/pesan/lacak" className="flex items-center gap-2 rounded-2xl bg-white/70 px-4 py-3 shadow-sm">
          <PackageSearch size={17} /> Lacak Pesanan
        </a>
        <a href="#chat-cart" className="flex items-center justify-between gap-2 rounded-2xl bg-white/70 px-4 py-3 shadow-sm">
          <span className="flex items-center gap-2"><ShoppingBag size={17} /> Keranjang</span>
          <span className="rounded-full bg-[#8d4b00] px-2 py-0.5 text-xs text-white">{cartCount}</span>
        </a>
        <a href="#bantuan" className="flex items-center gap-2 rounded-2xl bg-white/70 px-4 py-3 shadow-sm">
          <LifeBuoy size={17} /> Bantuan
        </a>
      </div>

      <div className="mt-6 min-h-0 flex-1 overflow-y-auto">
        <p className="mb-2 px-2 text-xs font-black uppercase tracking-[0.18em] text-[#9a5b08]">Riwayat Chat</p>
        <div className="space-y-2">
          {sessions.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-[#d7b276] p-4 text-sm font-bold text-[#735033]">Belum ada riwayat lain.</p>
          ) : sessions.map((session) => (
            <div key={session.id} className={`rounded-2xl border px-4 py-3 text-sm ${activeId === session.id ? 'border-[#8d4b00] bg-[#ffe1aa]' : 'border-[#ead2a7] bg-white/75'}`}>
              <p className="truncate font-black">{session.title || 'Pesanan Baru'}</p>
              <p className="mt-1 text-xs font-bold text-[#735033]">{session.status}</p>
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}
