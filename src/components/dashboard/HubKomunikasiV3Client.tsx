'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { Bot, CreditCard, MapPin, MessageSquare, PackageCheck, Pause, Play, Search, Send, ShoppingBag, UserRound } from 'lucide-react';
import { getChatV3Detail, getChatV3Sessions, sendChatV3AdminMessage, sendChatV3Card, setChatV3AiMode } from '@/actions/chat-v3-admin';
import type { ChatCartDto, ChatMessageDto, CustomerContextDto } from '@/lib/chat-v3/types';
import { formatRupiah } from '@/lib/utils';

type SessionRow = Awaited<ReturnType<typeof getChatV3Sessions>>[number];
type DetailState = {
  messages: ChatMessageDto[];
  cart: ChatCartDto | null;
  customerContext: CustomerContextDto;
  order: { id_transaksi: string; kode_pesanan: string | null; order_status: string; payment_status: string; total_bayar: number } | null;
  componentHistory: Array<{ messageId: string; type: string; createdAt: string }>;
  statusEvents: Array<{ id: number; event_type: string; order_status: string | null; payment_status: string | null; actor: string; note: string | null; created_at: string }>;
};

export function HubKomunikasiV3Client({ initialSessions }: { initialSessions: SessionRow[] }) {
  const [sessions, setSessions] = useState(initialSessions);
  const [selectedId, setSelectedId] = useState(initialSessions[0]?.id || '');
  const [detail, setDetail] = useState<DetailState | null>(null);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [aiMode, setAiMode] = useState('all');
  const [message, setMessage] = useState('');
  const [cardType, setCardType] = useState<'quick_replies' | 'product_cards' | 'location_picker' | 'payment_methods' | 'order_status_card'>('quick_replies');
  const [cardPayload, setCardPayload] = useState('');
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    refreshSessions();
  }, [search, status, aiMode]);

  useEffect(() => {
    if (!selectedId) return;
    startTransition(() => {
      getChatV3Detail(selectedId).then((data) => setDetail(data as DetailState));
    });
  }, [selectedId]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      refreshDetail();
    }, 15_000);
    return () => window.clearInterval(timer);
  }, [selectedId, search, status, aiMode]);

  const selected = useMemo(() => sessions.find((item) => item.id === selectedId), [sessions, selectedId]);

  function refreshSessions() {
    startTransition(() => {
      getChatV3Sessions({ search, status, aiMode }).then((rows) => {
        setSessions(rows);
        if (!selectedId && rows[0]) setSelectedId(rows[0].id);
      });
    });
  }

  function refreshDetail() {
    if (!selectedId) return;
    startTransition(() => {
      Promise.all([getChatV3Sessions({ search, status, aiMode }), getChatV3Detail(selectedId)]).then(([rows, data]) => {
        setSessions(rows);
        setDetail(data as DetailState);
      });
    });
  }

  function sendMessage() {
    if (!selectedId || !message.trim()) return;
    startTransition(async () => {
      await sendChatV3AdminMessage(selectedId, message);
      setMessage('');
      refreshDetail();
    });
  }

  function setMode(mode: 'enabled' | 'manual' | 'paused') {
    if (!selectedId) return;
    startTransition(async () => {
      await setChatV3AiMode(selectedId, mode);
      refreshDetail();
    });
  }

  function sendCard() {
    if (!selectedId) return;
    const payload = cardType === 'product_cards' ? { productIds: cardPayload } : cardType === 'quick_replies' ? { labels: cardPayload } : {};
    startTransition(async () => {
      await sendChatV3Card(selectedId, cardType, payload);
      setCardPayload('');
      refreshDetail();
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="font-headline-lg text-headline-lg text-on-surface">Hub Komunikasi V3</h1>
          <p className="mt-1 text-on-surface-variant font-body-md">Control center web chat AI `/pesan`: takeover, balas manual, kirim card, lihat customer, cart, dan order.</p>
        </div>
        <button onClick={refreshDetail} className="rounded-lg border border-outline-variant px-4 py-2 text-sm font-semibold text-on-surface-variant hover:bg-surface-container">Refresh</button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Metric icon={<MessageSquare size={20} />} label="Web Chat" value={sessions.length} />
        <Metric icon={<Bot size={20} />} label="AI Aktif" value={sessions.filter((item) => item.aiMode === 'enabled').length} />
        <Metric icon={<UserRound size={20} />} label="Butuh Admin" value={sessions.filter((item) => item.status === 'needs_admin').length} />
        <Metric icon={<PackageCheck size={20} />} label="Terhubung Order" value={sessions.filter((item) => item.activeOrderId).length} />
      </div>

      <div className="grid min-h-[680px] gap-4 xl:grid-cols-[360px_1fr_340px]">
        <section className="rounded-xl border border-neutral-200 bg-surface-container-lowest shadow-sm">
          <div className="space-y-3 border-b border-outline-variant/20 p-4">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cari nama, WA, order..." className="w-full rounded-lg border border-outline-variant bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-primary" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <select value={status} onChange={(event) => setStatus(event.target.value)} className="rounded-lg border border-outline-variant bg-white px-3 py-2 text-sm"><option value="all">Semua Status</option><option value="active">Active</option><option value="needs_admin">Needs Admin</option><option value="closed">Closed</option></select>
              <select value={aiMode} onChange={(event) => setAiMode(event.target.value)} className="rounded-lg border border-outline-variant bg-white px-3 py-2 text-sm"><option value="all">Semua Mode</option><option value="enabled">AI</option><option value="manual">Manual</option><option value="paused">Paused</option></select>
            </div>
          </div>
          <div className="max-h-[590px] overflow-y-auto">
            {sessions.map((session) => (
              <button key={session.id} onClick={() => setSelectedId(session.id)} className={`block w-full border-b border-outline-variant/10 p-4 text-left ${selectedId === session.id ? 'bg-primary-container/40' : 'bg-white hover:bg-surface-cream'}`}>
                <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate font-semibold text-on-surface">{session.customerName || session.title || 'Tamu Web'}</p><p className="mt-1 truncate font-mono text-[11px] text-on-surface-variant">{session.orderCode || session.id}</p></div><span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${session.status === 'needs_admin' ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'}`}>{session.aiMode}</span></div>
                <p className="mt-2 text-xs text-on-surface-variant">{session.paymentStatus || session.status} • {formatDate(session.updatedAt)}</p>
              </button>
            ))}
            {sessions.length === 0 && <div className="p-8 text-center text-sm font-medium text-on-surface-variant">Tidak ada chat.</div>}
          </div>
        </section>

        <section className="flex flex-col rounded-xl border border-neutral-200 bg-surface-container-lowest shadow-sm">
          <div className="flex items-center justify-between border-b border-outline-variant/20 p-4">
            <div><h2 className="font-headline-sm text-headline-sm text-on-surface">Percakapan</h2><p className="text-sm text-on-surface-variant">{selected?.customerName || selected?.title || selectedId || 'Pilih chat'}</p></div>
            <div className="flex gap-2"><button onClick={() => setMode('manual')} className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-2 text-xs font-bold text-on-primary"><Pause size={14} /> Manual</button><button onClick={() => setMode('enabled')} className="inline-flex items-center gap-1 rounded-lg bg-bot-indigo px-3 py-2 text-xs font-bold text-white"><Play size={14} /> AI</button></div>
          </div>
          <div className="flex max-h-[470px] flex-1 flex-col gap-3 overflow-y-auto bg-surface-cream/50 p-4">
            {detail?.messages.map((msg) => {
              const out = msg.role !== 'user';
              return <div key={msg.id} className={`flex ${out ? 'justify-start' : 'justify-end'}`}><div className={`max-w-[82%] rounded-2xl px-4 py-3 text-sm shadow-sm ${out ? 'bg-white text-on-surface' : 'bg-primary text-on-primary'}`}><div className="mb-1 text-[10px] font-bold uppercase opacity-70">{msg.role}</div><p className="whitespace-pre-wrap font-medium">{msg.content}</p>{msg.components.length > 0 && <div className="mt-2 flex flex-wrap gap-1">{msg.components.map((component, idx) => <span key={idx} className="rounded-full bg-black/10 px-2 py-0.5 text-[10px] font-bold">{component.type}</span>)}</div>}<p className="mt-2 text-right text-[10px] opacity-60">{formatDate(msg.createdAt)}</p></div></div>;
            })}
            {pending && <p className="text-center text-xs font-bold text-on-surface-variant">Memuat...</p>}
          </div>
          <div className="space-y-3 border-t border-outline-variant/20 bg-white p-4">
            <div className="flex gap-2"><input value={message} onChange={(event) => setMessage(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') sendMessage(); }} placeholder="Balas manual sebagai admin..." className="flex-1 rounded-xl border border-outline-variant px-3 py-2 text-sm outline-none focus:border-primary" /><button onClick={sendMessage} className="rounded-xl bg-primary px-4 py-2 text-on-primary"><Send size={17} /></button></div>
            <div className="grid gap-2 md:grid-cols-[180px_1fr_auto]"><select value={cardType} onChange={(event) => setCardType(event.target.value as typeof cardType)} className="rounded-xl border border-outline-variant px-3 py-2 text-sm"><option value="quick_replies">Quick Replies</option><option value="product_cards">Product Cards</option><option value="location_picker">Location Picker</option><option value="payment_methods">Payment Methods</option><option value="order_status_card">Order Status</option></select><input value={cardPayload} onChange={(event) => setCardPayload(event.target.value)} placeholder="Labels/Product IDs pisahkan koma" className="rounded-xl border border-outline-variant px-3 py-2 text-sm outline-none focus:border-primary" /><button onClick={sendCard} className="rounded-xl border border-primary px-4 py-2 text-sm font-bold text-primary">Kirim Card</button></div>
          </div>
        </section>

        <aside className="space-y-4">
          <Panel title="Customer"><Info label="Nama" value={detail?.customerContext.customer?.name || selected?.customerName || 'Tamu Web'} /><Info label="Phone" value={detail?.customerContext.customer?.phoneMasked || selected?.customerPhone || '-'} /><Info label="AI Mode" value={selected?.aiMode || '-'} /><Info label="Status" value={selected?.status || '-'} /></Panel>
          <Panel title="Order"><Info label="Kode" value={selected?.orderCode || detail?.order?.kode_pesanan || '-'} /><Info label="Status" value={selected?.orderStatus || detail?.order?.order_status || '-'} /><Info label="Pembayaran" value={selected?.paymentStatus || detail?.order?.payment_status || '-'} /><Info label="Total" value={formatRupiah(selected?.totalAmount || detail?.order?.total_bayar || 0)} /></Panel>
          <Panel title="Keranjang"><div className="rounded-lg bg-surface-container p-4"><div className="flex justify-between text-sm text-on-surface-variant"><span>Total item</span><span>{detail?.cart?.itemCount || 0}</span></div><div className="mt-1 flex justify-between text-lg font-bold text-on-surface"><span>Total</span><span>{formatRupiah(detail?.cart?.total || 0)}</span></div></div>{detail?.cart?.items.slice(0, 5).map((item) => <div key={item.id} className="mt-2 rounded-lg bg-white p-3 text-xs shadow-sm"><p className="font-bold text-on-surface">{item.productName}</p><p className="text-on-surface-variant">{item.quantity} × {formatRupiah(item.unitPrice)}</p></div>)}</Panel>
          <Panel title="Timeline"><div className="space-y-2">{detail?.statusEvents.slice(0, 8).map((event) => <div key={event.id} className="rounded-lg bg-white p-3 text-xs shadow-sm"><div className="flex items-start justify-between gap-2"><p className="font-bold text-on-surface">{formatEventName(event.event_type)}</p><span className="shrink-0 rounded-full bg-surface-cream px-2 py-0.5 font-bold text-on-surface-variant">{event.actor}</span></div><p className="mt-1 text-on-surface-variant">{event.order_status || '-'} • {event.payment_status || '-'}</p>{event.note && <p className="mt-1 text-on-surface">{event.note}</p>}<p className="mt-1 text-[10px] font-bold text-primary">{formatDate(event.created_at)}</p></div>)}{(!detail?.statusEvents.length) && <p className="text-sm text-on-surface-variant">Belum ada timeline order.</p>}</div></Panel>
          <Panel title="Memory"><div className="space-y-2">{detail?.customerContext.memory.slice(0, 6).map((mem) => <div key={mem.id} className="rounded-lg bg-white p-3 text-xs shadow-sm"><p className="font-bold text-on-surface">{mem.key}</p><p className="text-on-surface-variant">{mem.value}</p></div>)}{(!detail?.customerContext.memory.length) && <p className="text-sm text-on-surface-variant">Belum ada memory.</p>}</div></Panel>
        </aside>
      </div>
    </div>
  );
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return <div className="rounded-xl border border-neutral-200 bg-surface-container-lowest p-5 shadow-sm"><div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-primary-container text-primary">{icon}</div><p className="text-sm text-on-surface-variant">{label}</p><p className="mt-1 text-3xl font-bold text-on-surface">{value}</p></div>;
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  const icon = title === 'Order' ? <PackageCheck size={18} /> : title === 'Keranjang' ? <ShoppingBag size={18} /> : title === 'Memory' ? <Bot size={18} /> : <UserRound size={18} />;
  return <div className="rounded-xl border border-neutral-200 bg-surface-container-lowest p-5 shadow-sm"><div className="mb-3 flex items-center gap-2 text-primary">{icon}<h2 className="font-headline-sm text-headline-sm text-on-surface">{title}</h2></div>{children}</div>;
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="flex justify-between gap-3 border-b border-outline-variant/10 py-2 text-sm"><span className="text-on-surface-variant">{label}</span><span className="text-right font-semibold text-on-surface">{value}</span></div>;
}

function formatDate(value: string) {
  return new Date(`${value.endsWith('Z') ? value : `${value}Z`}`).toLocaleString('id-ID', { timeZone: 'Asia/Makassar', hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' });
}

function formatEventName(value: string) {
  return value.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase());
}
