'use client';

import { useState, useEffect, useRef } from 'react';
import {
  getDaftarChat,
  lepasKeBot,
  kirimPesanManual,
  getRiwayatChat,
  getStatsChat,
  ambilAlihChat
} from '@/actions/chat';
import {
  getCampaigns,
  createCampaign,
  sendCampaign,
  deleteCampaign,
  getTemplates,
  createTemplate,
  deleteTemplate
} from '@/actions/broadcast';
import { useToast } from '@/components/ui/toast';
import { Modal, ConfirmModal } from '@/components/ui/modal';
import { QuickReplyBar } from '@/components/livechat/QuickReplyBar';
import { InfoButton } from '@/components/ui/InfoButton';
import {
  ArrowLeft,
  ExternalLink,
  MessageSquare,
  Send,
  Bot,
  User,
  Search,
  Paperclip,
  Smile,
  MoreVertical,
  Hand,
  AlertTriangle,
  FileText,
  Plus,
  Trash2,
  Clock,
  CheckCircle,
  Loader2
} from 'lucide-react';
import { ChatListSkeleton } from '@/components/ui/skeleton';

interface ChatPelanggan {
  no_wa_pelanggan: string;
  nama_pelanggan: string | null;
  channel: 'wa' | 'telegram';
  status_handle: string;
  diambil_oleh: string | null;
  terakhir_aktif: string;
}

interface Pesan {
  channel: 'wa' | 'telegram';
  direction: string;
  sumber: string;
  teks: string;
  timestamp: string;
}

const avatarColors = [
  'bg-secondary-fixed text-on-secondary-container',
  'bg-tertiary-fixed text-on-tertiary-container',
  'bg-primary-fixed text-on-primary-fixed',
  'bg-blue-100 text-blue-700',
  'bg-purple-100 text-purple-700',
  'bg-pink-100 text-pink-700',
];

const TAG_OPTIONS = ['VIP', 'Prospek', 'Komplain', 'Pelanggan Baru', 'Butuh Follow-up', 'Tidak Aktif', 'Reseller', 'Dropshipper'];
const KATEGORI_TEMPLATE = ['Promo', 'Notifikasi', 'Ucapan', 'Lainnya'];

function getAdminName(): string {
  if (typeof window === 'undefined') return 'Admin';
  let name = localStorage.getItem('admin_name');
  if (!name) {
    name = prompt('Masukkan nama Anda:') || 'Admin';
    localStorage.setItem('admin_name', name);
  }
  return name;
}

export default function CommunicationHubPage() {
  const { addToast } = useToast();
  const [hubTab, setHubTab] = useState<'chat' | 'broadcast'>('chat');

  // --- LIVE CHAT STATES ---
  const [chatList, setChatList] = useState<ChatPelanggan[]>([]);
  const [stats, setStats] = useState({ aktif: 0, manual: 0, total: 0 });
  const [selectedChat, setSelectedChat] = useState<string | null>(null);
  const [messages, setMessages] = useState<Pesan[]>([]);
  const [messageInput, setMessageInput] = useState('');
  const [chatLoading, setChatLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [chatSearch, setChatSearch] = useState('');
  const [chatFilter, setChatFilter] = useState<'all' | 'manual' | 'bot'>('all');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // --- BROADCAST STATES ---
  const [broadcastTab, setBroadcastTab] = useState<'campaign' | 'template'>('campaign');
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [broadcastLoading, setBroadcastLoading] = useState(true);
  const [showNewCampaign, setShowNewCampaign] = useState(false);
  const [showNewTemplate, setShowNewTemplate] = useState(false);
  const [sendingCampaignId, setSendingCampaignId] = useState<number | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: number; type: 'campaign' | 'template' } | null>(null);

  const [formCampaign, setFormCampaign] = useState({ nama: '', pesan: '', target_tags: [] as string[] });
  const [formTemplate, setFormTemplate] = useState({ nama: '', konten: '', kategori: 'Promo' });

  // Initial Fetches
  useEffect(() => {
    fetchChatData().catch(console.error);
    fetchBroadcastData().catch(console.error);

    const chatInterval = setInterval(() => {
      if (hubTab === 'chat') fetchChatData().catch(console.error);
    }, 10000);

    return () => clearInterval(chatInterval);
  }, [hubTab]);

  useEffect(() => {
    if (selectedChat && hubTab === 'chat') {
      fetchMessages(selectedChat).catch(console.error);
      const msgInterval = setInterval(() => fetchMessages(selectedChat).catch(console.error), 5000);
      return () => clearInterval(msgInterval);
    }
  }, [selectedChat, hubTab]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Live Chat Fetch & Actions
  async function fetchChatData() {
    const [chatData, statsData] = await Promise.all([
      getDaftarChat(),
      getStatsChat(),
    ]);
    setChatList(chatData as any);
    setStats(statsData);
    setChatLoading(false);
  }

  async function fetchMessages(no_wa: string) {
    const data = await getRiwayatChat(no_wa);
    setMessages(data as any);
  }

  async function handleAmbilAlih(no_wa: string) {
    const adminName = getAdminName();
    const result = await ambilAlihChat(no_wa, adminName);
    if (result.success) {
      addToast('success', result.message);
    } else {
      addToast('error', result.message);
    }
    fetchChatData();
  }

  async function handleLepas(no_wa: string) {
    await lepasKeBot(no_wa);
    fetchChatData();
  }

  async function handleKirim(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedChat || !messageInput.trim() || sending) return;
    setSending(true);
    await kirimPesanManual(selectedChat, messageInput.trim());
    setMessageInput('');
    setSending(false);
    fetchMessages(selectedChat);
  }

  // Broadcast Fetch & Actions
  async function fetchBroadcastData() {
    setBroadcastLoading(true);
    const [c, t] = await Promise.all([getCampaigns(), getTemplates()]);
    setCampaigns(c);
    setTemplates(t);
    setBroadcastLoading(false);
  }

  async function handleCreateCampaign(e: React.FormEvent) {
    e.preventDefault();
    if (!formCampaign.nama || !formCampaign.pesan) return;
    const res = await createCampaign(formCampaign);
    addToast(res.success ? 'success' : 'error', res.message);
    if (res.success) {
      setShowNewCampaign(false);
      setFormCampaign({ nama: '', pesan: '', target_tags: [] });
      fetchBroadcastData();
    }
  }

  async function handleSendCampaign(id: number) {
    setSendingCampaignId(id);
    const res = await sendCampaign(id);
    addToast(res.success ? 'success' : 'error', res.message);
    setSendingCampaignId(null);
    fetchBroadcastData();
  }

  async function handleCreateTemplate(e: React.FormEvent) {
    e.preventDefault();
    if (!formTemplate.nama || !formTemplate.konten) return;
    const res = await createTemplate(formTemplate);
    addToast(res.success ? 'success' : 'error', res.message);
    if (res.success) {
      setShowNewTemplate(false);
      setFormTemplate({ nama: '', konten: '', kategori: 'Promo' });
      fetchBroadcastData();
    }
  }

  async function handleDeleteConfirm() {
    if (!deleteConfirm) return;
    const res = deleteConfirm.type === 'campaign'
      ? await deleteCampaign(deleteConfirm.id)
      : await deleteTemplate(deleteConfirm.id);
    addToast(res.success ? 'success' : 'error', res.message);
    setDeleteConfirm(null);
    fetchBroadcastData();
  }

  function toggleCampaignTag(tag: string) {
    setFormCampaign(f => ({
      ...f,
      target_tags: f.target_tags.includes(tag)
        ? f.target_tags.filter(t => t !== tag)
        : [...f.target_tags, tag],
    }));
  }

  // Shared Formatting Helpers
  function formatTime(ts: string) {
    const d = new Date(ts);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    const time = d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    if (isToday) return time;
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
  }

  function formatMessageTime(ts: string) {
    const d = new Date(ts);
    return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  }

  function getDateSeparator(ts: string) {
    const d = new Date(ts);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    if (isToday) return 'Today, ' + d.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  }

  function getAvatarColor(name: string) {
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return avatarColors[Math.abs(hash) % avatarColors.length];
  }

  function formatBroadcastDate(ts: string) {
    return new Date(ts + 'Z').toLocaleString('id-ID', { timeZone: 'Asia/Makassar' });
  }

  // Filters for Live Chat
  const filteredChats = chatList.filter((chat) => {
    if (chatFilter === 'manual' && chat.status_handle !== 'Manual_Admin') return false;
    if (chatFilter === 'bot' && chat.status_handle !== 'AI_Bot') return false;
    const name = (chat.nama_pelanggan || chat.no_wa_pelanggan).toLowerCase();
    return name.includes(chatSearch.toLowerCase());
  });

  const selectedData = chatList.find((c) => c.no_wa_pelanggan === selectedChat);
  const showMobileConversation = Boolean(selectedChat);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="font-headline-lg text-headline-lg text-on-surface">Live Chat & Chat Hub</h1>
          <p className="text-on-surface-variant font-body-md mt-1">
            Tangani obrolan langsung, broadcast campaign, dan akses Chat Hub web dari satu area kerja
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <InfoButton title="Live Chat & Chat Hub" description="Live Chat dipakai untuk WhatsApp/Telegram dan broadcast. Chat Hub web dipakai untuk percakapan AI `/pesan`, takeover, card, customer context, cart, dan order." usage="Gunakan tab Live Chat untuk balas WA/Telegram atau campaign. Klik Chat Hub Web untuk membuka control center percakapan web AI." />
          <a href="/hub-komunikasi" className="inline-flex items-center gap-2 rounded-xl border border-outline-variant bg-white px-4 py-2 text-sm font-semibold text-on-surface hover:bg-surface-container"><ExternalLink size={16} /> Chat Hub Web</a>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-surface-container-lowest border border-neutral-200 rounded-xl p-1 w-full md:w-fit">
        {[
          { key: 'chat' as const, label: 'Live Chat Panel', icon: MessageSquare },
          { key: 'broadcast' as const, label: 'Broadcast Campaign', icon: Send },
        ].map((t) => {
          const Icon = t.icon;
          const isActive = hubTab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setHubTab(t.key)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-label-md text-label-md transition-all flex-1 md:flex-initial justify-center whitespace-nowrap ${
                isActive ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant hover:bg-surface-container'
              }`}
            >
              <Icon size={16} />
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* --- TAB 1: LIVE CHAT --- */}
      {hubTab === 'chat' && (
        <div className="flex min-h-[70vh] flex-col gap-0 rounded-xl border border-outline-variant/20 bg-surface-cream shadow-sm md:h-[calc(100vh-14rem)] md:flex-row">
          {/* Chat List */}
          <section className={`${showMobileConversation ? 'hidden md:flex' : 'flex'} w-full flex-col bg-white md:w-[360px] md:shrink-0 md:border-r md:border-outline-variant/20`}>
            <div className="p-4 space-y-4 border-b border-outline-variant/10">
              <div className="relative group">
                <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />
                <input
                  type="text"
                  placeholder="Cari pelanggan..."
                  value={chatSearch}
                  onChange={(e) => setChatSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-surface-container-lowest border border-outline-variant rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-body-md text-body-md"
                />
              </div>
              <div className="flex gap-2 overflow-x-auto scrollbar-hide">
                {[
                  { key: 'all' as const, label: 'Semua' },
                  { key: 'manual' as const, label: 'Manual Admin' },
                  { key: 'bot' as const, label: 'AI Aktif' },
                ].map((f) => (
                  <button
                    key={f.key}
                    onClick={() => setChatFilter(f.key)}
                    className={`px-3 py-1.5 rounded-full font-label-md text-[11px] whitespace-nowrap transition-colors ${
                      chatFilter === f.key
                        ? 'bg-primary text-on-primary'
                        : 'bg-surface-container-high text-on-surface-variant hover:bg-outline-variant/20'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto scrollbar-thin md:min-h-0">
              {chatLoading ? (
                <ChatListSkeleton />
              ) : filteredChats.length === 0 ? (
                <div className="p-8 text-center text-on-surface-variant font-body-md">Belum ada percakapan</div>
              ) : (
                filteredChats.map((chat) => (
                  <button
                    key={chat.no_wa_pelanggan}
                    onClick={() => setSelectedChat(chat.no_wa_pelanggan)}
                    className={`w-full text-left p-4 flex gap-3 hover:bg-surface-cream cursor-pointer border-b border-outline-variant/5 transition-colors ${
                      selectedChat === chat.no_wa_pelanggan ? 'bg-surface-container-lowest border-l-4 border-l-primary' : 'bg-white'
                    }`}
                  >
                    <div className="relative shrink-0">
                      <div className={`w-11 h-11 rounded-full ${getAvatarColor(chat.nama_pelanggan || chat.no_wa_pelanggan)} flex items-center justify-center font-bold text-sm text-white`}>
                        {(chat.nama_pelanggan || '?').charAt(0).toUpperCase()}
                      </div>
                      {chat.status_handle === 'Manual_Admin' && (
                        <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-green-500 border-2 border-white" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start mb-1">
                        <span className="font-label-md text-label-md text-on-surface truncate font-semibold">
                          {chat.nama_pelanggan || chat.no_wa_pelanggan}
                        </span>
                        <span className="font-caption text-caption text-on-surface-variant shrink-0">
                          {formatTime(chat.terakhir_aktif)}
                        </span>
                      </div>
                      <p className="font-body-md text-body-md text-on-surface-variant truncate mb-2">
                        {chat.no_wa_pelanggan}
                      </p>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded font-label-md text-[9px] ${
                            chat.status_handle === 'AI_Bot' ? 'bg-bot-indigo text-white' : 'bg-primary text-white'
                          }`}>
                            {chat.status_handle === 'AI_Bot' ? <Bot size={10} /> : <User size={10} />}
                            {chat.status_handle === 'AI_Bot' ? 'AI' : 'MANUAL'}
                          </span>
                          <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded font-label-md text-[9px] font-bold ${
                            chat.channel === 'telegram' ? 'bg-sky-100 text-sky-700' : 'bg-green-100 text-green-700'
                          }`}>
                            {chat.channel === 'telegram' ? 'Telegram' : 'WhatsApp'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </section>

          {/* Chat Window */}
          <section className={`${showMobileConversation ? 'flex' : 'hidden'} relative min-h-[70vh] flex-1 flex-col bg-surface-cream md:flex`}>
            {!selectedChat ? (
              <div className="flex-1 flex items-center justify-center text-on-surface-variant">
                <div className="text-center">
                  <MessageSquare size={48} className="mx-auto mb-3 text-outline-variant" />
                  <p className="font-body-md">Pilih percakapan untuk mulai chatting</p>
                </div>
              </div>
            ) : (
              <>
                {/* Chat Header */}
                <div className="flex flex-col gap-3 border-b border-outline-variant/10 bg-white px-4 py-4 shadow-sm md:flex-row md:items-center md:justify-between md:px-6">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setSelectedChat(null)}
                      className="grid h-9 w-9 place-items-center rounded-full border border-outline-variant/30 text-on-surface-variant md:hidden"
                      aria-label="Kembali ke daftar chat"
                    >
                      <ArrowLeft size={16} />
                    </button>
                    <div className={`w-10 h-10 rounded-full ${getAvatarColor(selectedData?.nama_pelanggan || selectedChat)} flex items-center justify-center font-bold text-sm text-white`}>
                      {(selectedData?.nama_pelanggan || '?').charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="font-headline-sm text-[15px] text-on-surface font-bold">
                        {selectedData?.nama_pelanggan || selectedChat}
                      </h3>
                      <span className="font-caption text-caption text-green-600 font-semibold">
                        Online {selectedData?.status_handle === 'Manual_Admin' ? '\u2022 Sedang mengetik...' : ''}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex w-full items-center bg-surface-container rounded-full p-0.5 md:w-auto">
                      <button
                        onClick={() => handleAmbilAlih(selectedChat)}
                        className={`flex-1 px-4 py-1.5 rounded-full font-label-md text-label-md shadow-sm transition-all md:flex-initial ${
                          selectedData?.status_handle === 'Manual_Admin'
                            ? 'bg-primary text-white font-bold'
                            : 'text-on-surface-variant hover:bg-surface-container-highest'
                        }`}
                      >
                        Manual
                      </button>
                      <button
                        onClick={() => handleLepas(selectedChat)}
                        className={`flex-1 px-4 py-1.5 rounded-full font-label-md text-label-md transition-all md:flex-initial ${
                          selectedData?.status_handle === 'AI_Bot'
                            ? 'bg-bot-indigo text-white font-bold'
                            : 'text-on-surface-variant hover:bg-surface-container-highest'
                        }`}
                      >
                        AI Bot
                      </button>
                    </div>
                  </div>
                </div>

                {/* Messages Panel */}
                <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 scrollbar-thin md:p-6">
                  {messages.length === 0 ? (
                    <div className="text-center text-on-surface-variant font-body-md mt-8">Belum ada pesan</div>
                  ) : (
                    messages.map((msg, i) => {
                      const showDateSep = i === 0 || new Date(msg.timestamp).toDateString() !== new Date(messages[i - 1].timestamp).toDateString();
                      return (
                        <div key={i}>
                          {showDateSep && (
                            <div className="flex justify-center mb-4">
                              <span className="bg-surface-container px-3 py-1 rounded-full font-caption text-caption text-on-surface-variant font-semibold">
                                {getDateSeparator(msg.timestamp)}
                              </span>
                            </div>
                          )}
                          <div className={`flex flex-col ${msg.direction === 'out' ? 'items-end' : 'items-start'}`}>
                            <div className={`flex items-end gap-2 max-w-[92%] md:max-w-[85%] ${msg.direction === 'out' ? 'self-end' : ''}`}>
                              <div className={`p-4 rounded-2xl ${
                                msg.direction === 'out'
                                  ? msg.sumber === 'bot'
                                    ? 'rounded-br-none bg-bot-indigo text-white shadow-sm shadow-indigo-200'
                                    : 'rounded-br-none bg-primary text-on-primary shadow-sm shadow-primary/20'
                                  : 'rounded-bl-none bg-white border border-outline-variant/10 shadow-sm'
                              }`}>
                                {msg.direction === 'out' && (
                                  <span className="block text-[9px] uppercase font-bold tracking-wider opacity-85 mb-1 font-mono">
                                    {msg.sumber === 'bot' ? '🤖 AI Chatbot' : '👤 Admin'}
                                  </span>
                                )}
                                <p className="font-body-md text-body-md whitespace-pre-wrap">{msg.teks}</p>
                                <span className={`block text-right text-[9px] mt-1 font-semibold ${msg.direction === 'out' ? 'text-white/70' : 'text-on-surface-variant'}`}>
                                  {formatMessageTime(msg.timestamp)}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Input Panel */}
                <div className="border-t border-outline-variant/20 bg-white p-3 md:p-4">
                  <QuickReplyBar onSelect={(text) => setMessageInput(text)} />
                  <form onSubmit={handleKirim} className="mt-2 flex items-center gap-3 rounded-2xl bg-surface-container px-3 py-1.5 md:px-4">
                    <input
                      type="text"
                      value={messageInput}
                      onChange={(e) => setMessageInput(e.target.value)}
                      placeholder="Ketik pesan..."
                      className="flex-1 bg-transparent border-none py-3 font-body-md text-body-md focus:ring-0 focus:outline-none"
                      disabled={sending}
                    />
                    <button
                      type="submit"
                      disabled={!messageInput.trim() || sending}
                      className="w-10 h-10 rounded-xl bg-primary text-on-primary flex items-center justify-center hover:opacity-90 transition-colors shadow-sm disabled:opacity-50"
                    >
                      <Send size={18} />
                    </button>
                  </form>
                </div>
              </>
            )}
          </section>
        </div>
      )}

      {/* --- TAB 2: BROADCAST CAMPAIGN --- */}
      {hubTab === 'broadcast' && (
        <div className="space-y-6">
          <div className="flex gap-4">
            <button
              onClick={() => {
                if (broadcastTab === 'campaign') setShowNewCampaign(true);
                else setShowNewTemplate(true);
              }}
              className="bg-primary hover:opacity-95 text-on-primary px-4 py-2.5 rounded-lg font-label-md flex items-center gap-2 transition-all shadow-sm"
            >
              <Plus size={16} /> {broadcastTab === 'campaign' ? 'Campaign Baru' : 'Template Baru'}
            </button>

            {/* Sub-tab templates vs campaigns */}
            <div className="flex gap-1 bg-surface-container-high rounded-xl p-1">
              {[
                { key: 'campaign' as const, label: 'Semua Campaign' },
                { key: 'template' as const, label: 'Template Pesan' },
              ].map((t) => (
                <button
                  key={t.key}
                  onClick={() => setBroadcastTab(t.key)}
                  className={`px-4 py-1.5 rounded-lg font-label-md text-label-md transition-all ${
                    broadcastTab === t.key ? 'bg-white text-primary font-bold shadow-sm' : 'text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {broadcastTab === 'campaign' ? (
            <div>
              {broadcastLoading ? (
                <div className="space-y-3">
                  {[1, 2].map(i => <div key={i} className="animate-pulse h-28 bg-surface-container rounded-xl" />)}
                </div>
              ) : campaigns.length === 0 ? (
                <div className="bg-surface-container-lowest border border-neutral-200 rounded-xl p-12 text-center shadow-sm">
                  <Send size={48} className="mx-auto mb-3 text-outline-variant" />
                  <p className="font-body-md text-on-surface-variant">Belum ada campaign dibuat</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {campaigns.map(c => (
                    <div key={c.id} className="bg-surface-container-lowest border border-neutral-200 rounded-xl p-5 shadow-sm">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-headline-sm text-headline-sm text-on-surface truncate">{c.nama}</h3>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              c.status === 'sent' ? 'bg-green-100 text-green-700' :
                              c.status === 'sending' ? 'bg-blue-100 text-blue-700' :
                              'bg-gray-100 text-gray-700'
                            }`}>{c.status === 'sent' ? 'Terkirim' : c.status === 'sending' ? 'Mengirim...' : 'Draft'}</span>
                          </div>
                          <p className="font-body-md text-body-md text-on-surface-variant line-clamp-2 mb-2 whitespace-pre-wrap">{c.pesan}</p>
                          <div className="flex flex-wrap items-center gap-3 text-caption text-on-surface-variant font-semibold">
                            <span className="flex items-center gap-1"><Clock size={12} /> {formatBroadcastDate(c.created_at)}</span>
                            <span className="flex items-center gap-1"><CheckCircle size={12} /> {c.sent_count}/{c.total_count} terkirim</span>
                            {c.target_tags && c.target_tags !== '[]' && (
                              <span className="text-primary font-bold">Target: {JSON.parse(c.target_tags).join(', ')}</span>
                            )}
                            {c.target_tags === '[]' && <span>Target: Semua Pelanggan</span>}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {c.status === 'draft' && (
                            <button onClick={() => handleSendCampaign(c.id)} disabled={sendingCampaignId === c.id}
                              className="flex items-center gap-1.5 px-3 py-2 bg-primary text-on-primary rounded-lg font-label-md text-label-md hover:opacity-90 transition-opacity disabled:opacity-50 shadow-sm">
                              {sendingCampaignId === c.id ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                              Kirim Massal
                            </button>
                          )}
                          <button onClick={() => setDeleteConfirm({ id: c.id, type: 'campaign' })}
                            className="p-2 text-on-surface-variant hover:text-error rounded-lg hover:bg-error-container transition-colors">
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div>
              {templates.length === 0 ? (
                <div className="bg-surface-container-lowest border border-neutral-200 rounded-xl p-12 text-center shadow-sm">
                  <FileText size={48} className="mx-auto mb-3 text-outline-variant" />
                  <p className="font-body-md text-on-surface-variant">Belum ada template pesan disimpan</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-gutter">
                  {templates.map(t => (
                    <div key={t.id} className="bg-surface-container-lowest border border-neutral-200 rounded-xl p-5 shadow-sm">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h3 className="font-headline-sm text-headline-sm text-on-surface">{t.nama}</h3>
                          <span className="inline-block px-2 py-0.5 rounded-full bg-surface-container text-on-surface-variant text-[10px] font-bold mt-1 uppercase">{t.kategori}</span>
                        </div>
                        <button onClick={() => setDeleteConfirm({ id: t.id, type: 'template' })}
                          className="p-1.5 text-on-surface-variant hover:text-error rounded-lg hover:bg-error-container transition-colors">
                          <Trash2 size={16} />
                        </button>
                      </div>
                      <p className="font-body-md text-body-md text-on-surface-variant whitespace-pre-wrap line-clamp-3">{t.konten}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* --- MODALS --- */}
      <Modal open={showNewCampaign} onClose={() => setShowNewCampaign(false)} title="Buat Campaign Broadcast">
        <form onSubmit={handleCreateCampaign} className="space-y-4">
          <div>
            <label className="block font-label-md text-label-md text-on-surface mb-1">Nama Campaign</label>
            <input value={formCampaign.nama} onChange={e => setFormCampaign(f => ({ ...f, nama: e.target.value }))} required
              className="w-full px-3 py-2 bg-surface-container-lowest border border-outline-variant rounded-lg font-body-md focus:ring-primary focus:border-primary focus:outline-none"
              placeholder="Contoh: Promo Weekend" />
          </div>
          <div>
            <label className="block font-label-md text-label-md text-on-surface mb-1">Pesan Penawaran</label>
            <textarea value={formCampaign.pesan} onChange={e => setFormCampaign(f => ({ ...f, pesan: e.target.value }))} required rows={5}
              className="w-full px-3 py-2 bg-surface-container-lowest border border-outline-variant rounded-lg font-body-md focus:ring-primary focus:border-primary resize-none focus:outline-none"
              placeholder="Masukkan pesan penawaran di sini..." />
          </div>
          <div>
            <label className="block font-label-md text-label-md text-on-surface mb-2 font-bold">Target Broadcast (Grup Pelanggan)</label>
            <p className="font-caption text-caption text-on-surface-variant mb-2">Kosongkan target jika ingin menyasar ke seluruh pelanggan</p>
            <div className="flex flex-wrap gap-2">
              {TAG_OPTIONS.map(tag => (
                <button key={tag} type="button" onClick={() => toggleCampaignTag(tag)}
                  className={`px-3 py-1.5 rounded-full font-label-md text-label-md border transition-colors ${
                    formCampaign.target_tags.includes(tag)
                      ? 'bg-primary text-on-primary border-primary font-bold'
                      : 'bg-surface-container-high text-on-surface-variant border-outline-variant hover:bg-outline-variant'
                  }`}>{tag}</button>
              ))}
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="submit" className="flex-1 bg-primary text-on-primary py-2.5 rounded-lg font-label-md hover:opacity-90 transition-opacity">
              Daftarkan Campaign
            </button>
            <button type="button" onClick={() => setShowNewCampaign(false)}
              className="px-6 py-2.5 border border-outline-variant rounded-lg text-on-surface-variant font-label-md hover:bg-surface-container-high transition-colors">Batal</button>
          </div>
        </form>
      </Modal>

      <Modal open={showNewTemplate} onClose={() => setShowNewTemplate(false)} title="Buat Template Baru">
        <form onSubmit={handleCreateTemplate} className="space-y-4">
          <div>
            <label className="block font-label-md text-label-md text-on-surface mb-1">Nama Template</label>
            <input value={formTemplate.nama} onChange={e => setFormTemplate(f => ({ ...f, nama: e.target.value }))} required
              className="w-full px-3 py-2 bg-surface-container-lowest border border-outline-variant rounded-lg font-body-md focus:ring-primary focus:border-primary focus:outline-none"
              placeholder="Contoh: Template Balasan Pembelian" />
          </div>
          <div>
            <label className="block font-label-md text-label-md text-on-surface mb-1">Kategori</label>
            <select value={formTemplate.kategori} onChange={e => setFormTemplate(f => ({ ...f, kategori: e.target.value }))}
              className="w-full px-3 py-2 bg-surface-container-lowest border border-outline-variant rounded-lg font-body-md focus:ring-primary focus:border-primary focus:outline-none">
              {KATEGORI_TEMPLATE.map(k => <option key={k} value={k}>{k}</option>)}
            </select>
          </div>
          <div>
            <label className="block font-label-md text-label-md text-on-surface mb-1">Isi Template</label>
            <textarea value={formTemplate.konten} onChange={e => setFormTemplate(f => ({ ...f, konten: e.target.value }))} required rows={5}
              className="w-full px-3 py-2 bg-surface-container-lowest border border-outline-variant rounded-lg font-body-md focus:ring-primary focus:border-primary resize-none focus:outline-none"
              placeholder="Tulis konten template pesan..." />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="submit" className="flex-1 bg-primary text-on-primary py-2.5 rounded-lg font-label-md hover:opacity-90 transition-opacity">
              Simpan Template
            </button>
            <button type="button" onClick={() => setShowNewTemplate(false)}
              className="px-6 py-2.5 border border-outline-variant rounded-lg text-on-surface-variant font-label-md hover:bg-surface-container-high transition-colors">Batal</button>
          </div>
        </form>
      </Modal>

      <ConfirmModal
        open={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={handleDeleteConfirm}
        title={`Hapus ${deleteConfirm?.type === 'campaign' ? 'Campaign' : 'Template'}`}
        message="Apakah Anda yakin ingin menghapus item ini? Tindakan ini bersifat permanen."
        confirmLabel="Hapus"
        variant="danger"
      />
    </div>
  );
}
