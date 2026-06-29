'use client';

import { useState, useEffect, useRef } from 'react';
import { getDaftarChat, lepasKeBot, kirimPesanManual, getRiwayatChat, getStatsChat, ambilAlihChat } from '@/actions/chat';
import { MessageSquare, Send, Bot, User, Search, Paperclip, Smile, MoreVertical, Hand, AlertTriangle } from 'lucide-react';
import { ChatListSkeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/toast';

interface ChatPelanggan {
  no_wa_pelanggan: string;
  nama_pelanggan: string | null;
  status_handle: string;
  diambil_oleh: string | null;
  terakhir_aktif: string;
}

interface Pesan {
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

function getAdminName(): string {
  if (typeof window === 'undefined') return 'Admin';
  let name = localStorage.getItem('admin_name');
  if (!name) {
    name = prompt('Masukkan nama Anda:') || 'Admin';
    localStorage.setItem('admin_name', name);
  }
  return name;
}

export default function LiveChatPage() {
  const { addToast } = useToast();
  const [chatList, setChatList] = useState<ChatPelanggan[]>([]);
  const [stats, setStats] = useState({ aktif: 0, manual: 0, total: 0 });
  const [selectedChat, setSelectedChat] = useState<string | null>(null);
  const [messages, setMessages] = useState<Pesan[]>([]);
  const [messageInput, setMessageInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'manual' | 'bot'>('all');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchData().catch(console.error);
    const interval = setInterval(() => fetchData().catch(console.error), 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (selectedChat) {
      fetchMessages(selectedChat).catch(console.error);
      const interval = setInterval(() => fetchMessages(selectedChat).catch(console.error), 5000);
      return () => clearInterval(interval);
    }
  }, [selectedChat]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function fetchData() {
    const [chatData, statsData] = await Promise.all([
      getDaftarChat(),
      getStatsChat(),
    ]);
    setChatList(chatData);
    setStats(statsData);
    setLoading(false);
  }

  async function fetchMessages(no_wa: string) {
    const data = await getRiwayatChat(no_wa);
    setMessages(data);
  }

  async function handleAmbilAlih(no_wa: string) {
    const adminName = getAdminName();
    const result = await ambilAlihChat(no_wa, adminName);
    if (result.success) {
      addToast('success', result.message);
    } else {
      addToast('error', result.message);
    }
    fetchData();
  }

  async function handleLepas(no_wa: string) {
    await lepasKeBot(no_wa);
    fetchData();
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

  const filteredChats = chatList.filter((chat) => {
    if (filter === 'manual' && chat.status_handle !== 'Manual_Admin') return false;
    if (filter === 'bot' && chat.status_handle !== 'AI_Bot') return false;
    const name = (chat.nama_pelanggan || chat.no_wa_pelanggan).toLowerCase();
    return name.includes(search.toLowerCase());
  });

  const selectedData = chatList.find((c) => c.no_wa_pelanggan === selectedChat);

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col md:flex-row gap-0 bg-surface-cream rounded-xl overflow-hidden border border-outline-variant/20">
      {/* Chat List */}
      <section className="w-full md:w-[380px] flex flex-col bg-white border-r border-outline-variant/20 shrink-0">
        <div className="p-4 space-y-4 border-b border-outline-variant/10">
          <div className="relative group">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />
            <input
              type="text"
              placeholder="Cari pelanggan..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-surface-container-lowest border border-outline-variant rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-body-md text-body-md"
            />
          </div>
          <div className="flex gap-2 overflow-x-auto scrollbar-hide">
            {[
              { key: 'all' as const, label: 'Semua' },
              { key: 'manual' as const, label: 'Perlu Penanganan' },
              { key: 'bot' as const, label: 'AI Aktif' },
            ].map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`px-4 py-1.5 rounded-full font-label-md text-label-md whitespace-nowrap transition-colors ${
                  filter === f.key
                    ? 'bg-primary text-on-primary'
                    : 'bg-surface-container-high text-on-surface-variant hover:bg-outline-variant/20'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-thin">
          {loading ? (
            <ChatListSkeleton />
          ) : filteredChats.length === 0 ? (
            <div className="p-8 text-center text-on-surface-variant font-body-md">Belum ada percakapan</div>
          ) : (
            filteredChats.map((chat) => (
              <button
                key={chat.no_wa_pelanggan}
                onClick={() => setSelectedChat(chat.no_wa_pelanggan)}
                className={`w-full text-left p-4 flex gap-3 hover:bg-surface-cream cursor-pointer border-b border-outline-variant/5 transition-colors ${
                  selectedChat === chat.no_wa_pelanggan ? 'bg-surface-container-lowest' : 'bg-white'
                }`}
              >
                <div className="relative shrink-0">
                  <div className={`w-12 h-12 rounded-full ${getAvatarColor(chat.nama_pelanggan || chat.no_wa_pelanggan)} flex items-center justify-center font-bold text-sm`}>
                    {(chat.nama_pelanggan || '?').charAt(0).toUpperCase()}
                  </div>
                  {chat.status_handle === 'Manual_Admin' && (
                    <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-green-500 border-2 border-white" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start mb-1">
                    <span className="font-label-md text-label-md text-on-surface truncate">
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
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-label-md text-[10px] ${
                        chat.status_handle === 'AI_Bot'
                          ? 'bg-bot-indigo text-white'
                          : 'bg-primary text-white'
                      }`}>
                        {chat.status_handle === 'AI_Bot' ? <Bot size={12} /> : <User size={12} />}
                        {chat.status_handle === 'AI_Bot' ? 'AI_BOT' : 'MANUAL_ADMIN'}
                      </span>
                      {chat.diambil_oleh && (
                        <span className="inline-flex items-center gap-1 text-[10px] text-on-surface-variant bg-surface-container px-1.5 py-0.5 rounded-md">
                          <AlertTriangle size={10} />
                          {chat.diambil_oleh}
                        </span>
                      )}
                    </div>
                    {chat.status_handle === 'AI_Bot' && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleAmbilAlih(chat.no_wa_pelanggan); }}
                        className="text-primary font-label-md text-label-md flex items-center gap-1 hover:underline active:scale-95 transition-transform"
                      >
                        <Hand size={14} />
                        Ambil Alih
                      </button>
                    )}
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </section>

      {/* Chat Window */}
      <section className="hidden md:flex flex-1 flex-col bg-surface-cream relative">
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
            <div className="px-6 py-4 bg-white flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full ${getAvatarColor(selectedData?.nama_pelanggan || selectedChat)} flex items-center justify-center font-bold text-sm`}>
                  {(selectedData?.nama_pelanggan || '?').charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 className="font-headline-sm text-[16px] text-on-surface font-bold">
                    {selectedData?.nama_pelanggan || selectedChat}
                  </h3>
                  <span className="font-caption text-caption text-green-600">
                    Online {selectedData?.status_handle === 'Manual_Admin' ? '\u2022 Sedang mengetik...' : ''}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center bg-surface-container rounded-full p-0.5">
                  <button
                    onClick={() => handleAmbilAlih(selectedChat)}
                    className={`px-4 py-1.5 rounded-full font-label-md text-label-md shadow-sm transition-all ${
                      selectedData?.status_handle === 'Manual_Admin'
                        ? 'bg-primary text-white'
                        : 'text-on-surface-variant hover:bg-surface-container-highest'
                    }`}
                  >
                    Manual
                  </button>
                  <button
                    onClick={() => handleLepas(selectedChat)}
                    className={`px-4 py-1.5 rounded-full font-label-md text-label-md transition-all ${
                      selectedData?.status_handle === 'AI_Bot'
                        ? 'bg-bot-indigo text-white'
                        : 'text-on-surface-variant hover:bg-surface-container-highest'
                    }`}
                  >
                    AI Bot
                  </button>
                </div>
                <button className="p-2 text-on-surface-variant hover:bg-surface-container rounded-full transition-colors">
                  <MoreVertical size={18} />
                </button>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-4 scrollbar-thin">
              {messages.length === 0 ? (
                <div className="text-center text-on-surface-variant font-body-md mt-8">Belum ada pesan</div>
              ) : (
                messages.map((msg, i) => {
                  const showDateSep = i === 0 || new Date(msg.timestamp).toDateString() !== new Date(messages[i - 1].timestamp).toDateString();
                  return (
                    <div key={i}>
                      {showDateSep && (
                        <div className="flex justify-center mb-4">
                          <span className="bg-surface-container px-3 py-1 rounded-full font-caption text-caption text-on-surface-variant">
                            {getDateSeparator(msg.timestamp)}
                          </span>
                        </div>
                      )}
                      <div className={`flex items-end gap-2 max-w-[80%] ${msg.direction === 'out' ? 'self-end' : ''}`}>
                        <div className={`p-4 rounded-2xl ${msg.direction === 'out' ? 'rounded-br-none bg-primary text-on-primary shadow-sm shadow-primary/20' : 'rounded-bl-none bg-white border border-outline-variant/10 shadow-sm'}`}>
                          <p className="font-body-md text-body-md whitespace-pre-wrap">{msg.teks}</p>
                          <span className={`block text-right font-caption text-[9px] mt-1 ${msg.direction === 'out' ? 'text-primary-fixed-dim' : 'text-on-surface-variant'}`}>
                            {formatMessageTime(msg.timestamp)}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="p-4 bg-white border-t border-outline-variant/20">
              <form onSubmit={handleKirim} className="flex items-center gap-3 bg-surface-container px-4 py-1.5 rounded-2xl">
                <button type="button" className="text-on-surface-variant hover:text-primary transition-colors">
                  <Paperclip size={20} />
                </button>
                <input
                  type="text"
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  placeholder="Ketik pesan..."
                  className="flex-1 bg-transparent border-none focus:outline-none font-body-md text-body-md py-3"
                  disabled={sending}
                />
                <div className="flex items-center gap-1">
                  <button type="button" className="text-on-surface-variant hover:text-primary transition-colors">
                    <Smile size={20} />
                  </button>
                  <button
                    type="submit"
                    disabled={!messageInput.trim() || sending}
                    className="w-10 h-10 rounded-xl bg-primary text-on-primary flex items-center justify-center hover:bg-primary-container transition-colors shadow-sm disabled:opacity-50"
                  >
                    <Send size={18} />
                  </button>
                </div>
              </form>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
