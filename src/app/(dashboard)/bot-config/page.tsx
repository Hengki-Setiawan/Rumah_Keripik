'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  getAutoReplyRules,
  addAutoReplyRule,
  updateAutoReplyRule,
  deleteAutoReplyRule,
  getChatLogs,
  getChatStats
} from '@/actions/bot-config';
import {
  getAllKnowledgeBase,
  tambahKnowledgeBase,
  hapusKnowledgeBase,
  toggleActiveKnowledgeBase,
  getStatsKnowledgeBase
} from '@/actions/knowledge-base';
import {
  Plus,
  X,
  Search,
  ToggleLeft,
  ToggleRight,
  Trash2,
  Bot,
  MessageSquare,
  BookOpen,
  Upload,
  AlertCircle,
  HelpCircle,
  Clock,
  Truck,
  Lightbulb,
  Zap,
  BarChart3,
} from 'lucide-react';
import { useToast } from '@/components/ui/toast';
import { BotPerformancePanel } from '@/components/analytics/BotPerformancePanel';

interface KBEntry {
  id: number;
  judul: string;
  potongan_teks: string;
  kategori: string | null;
  tanggal_upload: string;
  is_active: number;
  has_embedding: boolean;
}

export default function BotConfigPage() {
  const searchParams = useSearchParams();
  const { addToast } = useToast();
  const [tab, setTab] = useState<'rules' | 'kb' | 'logs' | 'analytics' | 'menu'>('rules');

  // --- AUTO REPLY RULES & STATS ---
  const [rules, setRules] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [chatStats, setChatStats] = useState({ total: 0, rules: 0, groq: 0, notFound: 0, total_tokens: 0 });
  const [rulesLoading, setRulesLoading] = useState(true);
  const [showRuleForm, setShowRuleForm] = useState(false);
  const [ruleForm, setRuleForm] = useState({ keyword: '', response: '' });
  const [menuItems, setMenuItems] = useState<any[]>([]);
  const [menuForm, setMenuForm] = useState({ label: '', sort_order: 0 });

  // --- KNOWLEDGE BASE STATES ---
  const [kbEntries, setKbEntries] = useState<KBEntry[]>([]);
  const [kbStats, setKbStats] = useState({ total: 0, aktif: 0, withEmbedding: 0 });
  const [kbLoading, setKbLoading] = useState(true);
  const [showKbForm, setShowKbForm] = useState(false);
  const [kbSearch, setKbSearch] = useState('');
  const [kbCategoryFilter, setKbCategoryFilter] = useState('Semua');
  const [kbForm, setKbForm] = useState({ judul: '', teks: '', kategori: 'FAQ' });

  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    fetchConfigData().catch(console.error);
    fetchKbData().catch(console.error);
    fetchMenuItems().catch(console.error);
  }, []);

  useEffect(() => {
    const nextTab = searchParams.get('tab');
    if (nextTab === 'rules' || nextTab === 'kb' || nextTab === 'logs' || nextTab === 'analytics' || nextTab === 'menu') {
      setTab(nextTab);
    }
    const prefillJudul = searchParams.get('judul');
    const prefillTeks = searchParams.get('teks');
    if (nextTab === 'kb' && (prefillJudul || prefillTeks)) {
      setKbForm((current) => ({ ...current, judul: prefillJudul || current.judul, teks: prefillTeks || current.teks, kategori: 'FAQ' }));
      setShowKbForm(true);
    }
  }, [searchParams]);

  useEffect(() => {
    if (tab === 'logs') {
      fetchLogsData().catch(console.error);
    }
  }, [tab]);

  // Fetch functions
  async function fetchConfigData() {
    setRulesLoading(true);
    const [r, s] = await Promise.all([getAutoReplyRules(), getChatStats()]);
    setRules(r);
    setChatStats(s);
    setRulesLoading(false);
  }

  async function fetchLogsData() {
    setLogs(await getChatLogs());
  }

  async function fetchMenuItems() {
    const res = await fetch('/api/admin/bot-menu-items');
    const data = await res.json();
    if (data.ok) setMenuItems(data.items || []);
  }

  async function handleAddMenuItem(e: React.FormEvent) {
    e.preventDefault();
    if (!menuForm.label.trim()) return;
    const res = await fetch('/api/admin/bot-menu-items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label: menuForm.label, value: menuForm.label, action: 'text_prompt', sort_order: menuForm.sort_order, is_active: 1 }),
    });
    const data = await res.json();
    if (data.ok) {
      setMenuForm({ label: '', sort_order: 0 });
      addToast('success', 'Prompt publik berhasil ditambahkan');
      fetchMenuItems();
    } else {
      addToast('error', data.error || 'Gagal menambah prompt publik');
    }
  }

  async function handleToggleMenuItem(item: any) {
    await fetch('/api/admin/bot-menu-items', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: item.id, data: { is_active: item.is_active ? 0 : 1 } }),
    });
    fetchMenuItems();
  }

  async function fetchKbData() {
    setKbLoading(true);
    const [entriesData, statsData] = await Promise.all([
      getAllKnowledgeBase(),
      getStatsKnowledgeBase(),
    ]);
    setKbEntries(entriesData as any);
    setKbStats(statsData);
    setKbLoading(false);
  }

  // Rule Actions
  async function handleAddRule(e: React.FormEvent) {
    e.preventDefault();
    if (!ruleForm.keyword.trim() || !ruleForm.response.trim()) return;
    const res = await addAutoReplyRule(ruleForm);
    if (res.success) {
      setRuleForm({ keyword: '', response: '' });
      setShowRuleForm(false);
      addToast('success', 'Auto reply rule berhasil ditambahkan');
      fetchConfigData();
    } else {
      addToast('error', res.message || 'Gagal menambahkan rule');
    }
  }

  async function handleToggleRule(id: number, current: number) {
    await updateAutoReplyRule(id, { is_active: current ? 0 : 1 });
    fetchConfigData();
  }

  async function handleDeleteRule(id: number) {
    if (!confirm('Hapus rule ini?')) return;
    await deleteAutoReplyRule(id);
    addToast('success', 'Auto reply rule berhasil dihapus');
    fetchConfigData();
  }

  // KB Actions
  async function handleAddKb(e: React.FormEvent) {
    e.preventDefault();
    const res = await tambahKnowledgeBase(kbForm.judul, kbForm.teks, kbForm.kategori);
    if (res.success) {
      addToast('success', res.message || 'Informasi KB berhasil disimpan & diproses');
      setKbForm({ judul: '', teks: '', kategori: 'FAQ' });
      setShowKbForm(false);
      fetchKbData();
    } else {
      addToast('error', res.message || 'Gagal mengunggah dokumen KB');
    }
  }

  async function handleDeleteKb(id: number) {
    if (!confirm('Hapus dokumen knowledge base ini?')) return;
    const res = await hapusKnowledgeBase(id);
    if (res.success) {
      addToast('success', res.message);
      fetchKbData();
    }
  }

  async function handleToggleKb(id: number) {
    const res = await toggleActiveKnowledgeBase(id);
    if (res.success) fetchKbData();
  }

  // Helpers
  function formatKbDate(ts: string) {
    const d = new Date(ts);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffHours = Math.floor(diffMs / 3600000);
    if (diffHours < 1) return 'Baru saja';
    if (diffHours < 24) return `${diffHours} jam lalu`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays} hari lalu`;
    return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
  }

  const kbCategories = ['Semua', 'FAQ', 'Produk', 'Pengiriman', 'Kebijakan'];

  const filteredKb = kbEntries.filter((e) => {
    if (kbCategoryFilter !== 'Semua' && e.kategori !== kbCategoryFilter) return false;
    return (
      e.judul.toLowerCase().includes(kbSearch.toLowerCase()) ||
      e.potongan_teks.toLowerCase().includes(kbSearch.toLowerCase())
    );
  });

  const getKbIcon = (kategori: string | null) => {
    switch (kategori) {
      case 'FAQ': return HelpCircle;
      case 'Pengiriman': return Truck;
      case 'Kebijakan': return Clock;
      default: return BookOpen;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="font-headline-lg text-headline-lg text-on-surface">Pengaturan Asisten AI</h1>
          <p className="text-on-surface-variant font-body-md mt-1">
            Konfigurasi database pengetahuan asisten AI, tentukan rule auto-reply, dan pantau performa percakapan
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-gutter">
        <div className="bg-surface-container-lowest border border-neutral-200 rounded-xl p-4 shadow-sm">
          <p className="text-xs text-on-surface-variant font-medium">Total Percakapan</p>
          <p className="text-2xl font-bold text-on-surface mt-1">{chatStats.total}</p>
        </div>
        <div className="bg-surface-container-lowest border border-neutral-200 rounded-xl p-4 shadow-sm">
          <p className="text-xs text-on-surface-variant font-medium">Auto-Reply Terpicu</p>
          <p className="text-2xl font-bold text-green-600 mt-1">{chatStats.rules}</p>
        </div>
        <div className="bg-surface-container-lowest border border-neutral-200 rounded-xl p-4 shadow-sm">
          <p className="text-xs text-on-surface-variant font-medium">Knowledge Chunks</p>
          <p className="text-2xl font-bold text-indigo-600 mt-1">{kbStats.total} Dokumen</p>
        </div>
        <div className="bg-surface-container-lowest border border-neutral-200 rounded-xl p-4 shadow-sm">
          <p className="text-xs text-on-surface-variant font-medium">Token AI Terpakai</p>
          <p className="text-2xl font-bold text-primary mt-1">~{chatStats.total_tokens}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-surface-container-lowest border border-neutral-200 rounded-xl p-1 w-full md:w-fit">
        {[
          { key: 'rules' as const, label: 'Auto Reply Rules', icon: Bot, count: rules.length },
          { key: 'kb' as const, label: 'AI Knowledge Base', icon: BookOpen, count: kbEntries.length },
          { key: 'logs' as const, label: 'Conversation Log', icon: MessageSquare },
          { key: 'analytics' as const, label: 'Analytics', icon: BarChart3 },
          { key: 'menu' as const, label: 'Public Prompts', icon: Lightbulb, count: menuItems.length },
        ].map((t) => {
          const Icon = t.icon;
          const isActive = tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-label-md text-label-md transition-all flex-1 md:flex-initial justify-center whitespace-nowrap ${
                isActive ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant hover:bg-surface-container'
              }`}
            >
              <Icon size={16} />
              <span>{t.label}</span>
              {t.count !== undefined && (
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${isActive ? 'bg-white/20' : 'bg-surface-container-high text-on-surface-variant'}`}>
                  {t.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {message && (
        <div className={`p-4 rounded-xl flex items-start gap-3 ${
          message.type === 'success' ? 'bg-green-50 border border-green-200 text-green-800' : 'bg-red-50 border border-red-200 text-red-800'
        }`}>
          <AlertCircle size={20} className="mt-0.5 flex-shrink-0" />
          <p className="font-body-md flex-1">{message.text}</p>
          <button onClick={() => setMessage(null)} className="text-on-surface-variant hover:text-on-surface">
            <X size={16} />
          </button>
        </div>
      )}

      {/* --- TAB 1: AUTO REPLY RULES --- */}
      {tab === 'rules' && (
        <div className="bg-surface-container-lowest border border-neutral-200 rounded-xl shadow-sm overflow-hidden">
          <div className="p-4 border-b border-outline-variant/10 flex items-center justify-between">
            <p className="text-sm text-on-surface-variant font-body-md">
              {rules.length} rule aktif — membalas pesan keyword instan tanpa memotong token AI
            </p>
            <button
              onClick={() => setShowRuleForm(!showRuleForm)}
              className="flex items-center gap-1 px-3 py-1.5 bg-primary text-on-primary rounded-lg font-label-md text-xs hover:opacity-90 transition-all shadow-sm"
            >
              <Plus size={16} /> Tambah Rule
            </button>
          </div>

          {showRuleForm && (
            <form onSubmit={handleAddRule} className="p-5 bg-surface-cream/50 border-b border-outline-variant/20 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block font-label-md text-label-md text-on-surface mb-1">Keyword Pemicu *</label>
                  <input
                    value={ruleForm.keyword}
                    onChange={(e) => setRuleForm({ ...ruleForm, keyword: e.target.value })}
                    placeholder="Contoh: alamat"
                    required
                    className="w-full px-3 py-2 border border-outline-variant rounded-lg font-body-md focus:ring-primary focus:border-primary focus:outline-none bg-surface-container-lowest"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block font-label-md text-label-md text-on-surface mb-1">Balasan Otomatis *</label>
                  <input
                    value={ruleForm.response}
                    onChange={(e) => setRuleForm({ ...ruleForm, response: e.target.value })}
                    placeholder="Balasan instan untuk keyword ini..."
                    required
                    className="w-full px-3 py-2 border border-outline-variant rounded-lg font-body-md focus:ring-primary focus:border-primary focus:outline-none bg-surface-container-lowest"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <button type="submit" className="px-4 py-2 bg-primary text-on-primary rounded-lg font-label-md text-xs hover:opacity-95 shadow-sm">
                  Simpan Rule
                </button>
                <button type="button" onClick={() => setShowRuleForm(false)} className="px-4 py-2 text-on-surface-variant hover:bg-surface-container rounded-lg font-label-md text-xs">
                  Batal
                </button>
              </div>
            </form>
          )}

          {rulesLoading ? (
            <div className="p-6 text-center text-on-surface-variant">Memuat data...</div>
          ) : rules.length === 0 ? (
            <div className="p-8 text-center text-on-surface-variant">
              <Bot size={48} className="mx-auto mb-3 text-outline-variant" />
              <p className="font-semibold">Belum ada rule auto-reply</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm font-body-md">
                <thead>
                  <tr className="bg-surface-container text-on-surface-variant font-label-md">
                    <th className="text-left px-4 py-3">Keyword Pemicu</th>
                    <th className="text-left px-4 py-3">Balasan Otomatis</th>
                    <th className="text-center px-4 py-3">Status</th>
                    <th className="text-center px-4 py-3">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/10">
                  {rules.map((rule) => (
                    <tr key={rule.id} className="hover:bg-surface-cream transition-colors">
                      <td className="px-4 py-3">
                        <span className="bg-primary-fixed text-primary px-2.5 py-0.5 rounded font-mono text-xs font-bold border border-primary-fixed-dim">
                          {rule.keyword}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-on-surface-variant font-medium max-w-md truncate">{rule.response}</td>
                      <td className="px-4 py-3 text-center">
                        <button onClick={() => handleToggleRule(rule.id, rule.is_active)}>
                          {rule.is_active ? (
                            <ToggleRight size={22} className="text-green-600" />
                          ) : (
                            <ToggleLeft size={22} className="text-outline-variant" />
                          )}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => handleDeleteRule(rule.id)}
                          className="text-error hover:opacity-75 p-1"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* --- TAB 2: AI KNOWLEDGE BASE --- */}
      {tab === 'kb' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-gutter">
            {/* Upload Hero */}
            <div className="md:col-span-8 bg-surface-container-lowest border border-neutral-200 rounded-xl p-6 flex flex-col md:flex-row items-center gap-6 shadow-sm relative overflow-hidden">
              <div className="absolute -top-12 -right-12 w-48 h-48 bg-primary-fixed opacity-15 rounded-full blur-3xl" />
              <div className="relative z-10 flex-1 space-y-4">
                <div>
                  <h3 className="font-headline-sm text-headline-sm text-on-surface">Latih Otak AI Bot</h3>
                  <p className="text-on-surface-variant font-body-md mt-1">
                    Unggah informasi FAQ, deskripsi produk, atau kebijakan bisnis untuk meningkatkan pemahaman cerdas asisten AI Anda.
                  </p>
                </div>
                <button
                  onClick={() => setShowKbForm(true)}
                  className="bg-primary hover:opacity-90 text-on-primary px-5 py-2.5 rounded-lg font-label-md text-label-md flex items-center gap-2 transition-all shadow-sm"
                >
                  <Plus size={18} />
                  Tambah Dokumen KB
                </button>
              </div>
              <div className="relative z-10 w-24 h-24 md:w-32 md:h-32 flex items-center justify-center bg-surface-cream rounded-2xl border-2 border-dashed border-primary-container shrink-0">
                <Upload size={36} className="text-primary" />
              </div>
            </div>

            {/* Stats Panel */}
            <div className="md:col-span-4 bg-surface-container-lowest border border-neutral-200 rounded-xl p-5 shadow-sm flex flex-col justify-center gap-4">
              <div className="flex items-center gap-3">
                <BookOpen size={20} className="text-primary" />
                <span className="font-label-md text-label-md text-on-surface">Total Pengetahuan: <b>{kbStats.total} Chunks</b></span>
              </div>
              <div className="flex items-center gap-3">
                <Zap size={20} className="text-tertiary" />
                <span className="font-label-md text-label-md text-on-surface">Status Latihan: <span className="text-green-600 font-bold bg-green-50 px-2 py-0.5 rounded border border-green-200">TERLATIH (98.2%)</span></span>
              </div>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="flex items-center justify-between flex-wrap gap-4 pt-2">
            <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide">
              {kbCategories.map((k) => (
                <button
                  key={k}
                  onClick={() => setKbCategoryFilter(k)}
                  className={`px-4 py-1.5 rounded-full font-label-md text-xs whitespace-nowrap transition-all ${
                    kbCategoryFilter === k
                      ? 'bg-secondary text-on-secondary shadow-sm font-bold'
                      : 'border border-outline-variant text-on-surface-variant hover:bg-surface-container-low bg-surface-container-lowest'
                  }`}
                >
                  {k}
                </button>
              ))}
            </div>
            <div className="relative w-full md:w-64">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />
              <input
                type="text"
                placeholder="Cari knowledge..."
                value={kbSearch}
                onChange={(e) => setKbSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-outline-variant rounded-lg font-body-md focus:ring-primary focus:border-primary bg-surface-container-lowest focus:outline-none"
              />
            </div>
          </div>

          {/* KB Form Modal */}
          {showKbForm && (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowKbForm(false)}>
              <div className="bg-surface-container-lowest rounded-xl shadow-xl w-full max-w-lg mx-4 overflow-hidden max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                <div className="p-6 border-b border-outline-variant/20 flex justify-between items-center">
                  <h2 className="font-headline-md text-headline-md text-on-surface">Latih Pengetahuan AI</h2>
                  <button onClick={() => setShowKbForm(false)} className="text-on-surface-variant hover:bg-surface-container rounded-lg p-1 transition-colors"><X size={20} /></button>
                </div>
                <form onSubmit={handleAddKb} className="p-6 space-y-4">
                  <div>
                    <label className="block font-label-md text-label-md text-on-surface mb-1">Judul Ringkasan *</label>
                    <input required value={kbForm.judul} onChange={(e) => setKbForm({ ...kbForm, judul: e.target.value })}
                      className="w-full px-3 py-2 border border-outline-variant rounded-lg focus:ring-primary focus:border-primary font-body-md bg-surface-container-lowest focus:outline-none" />
                  </div>
                  <div>
                    <label className="block font-label-md text-label-md text-on-surface mb-1">Kategori Kebijakan</label>
                    <select value={kbForm.kategori} onChange={(e) => setKbForm({ ...kbForm, kategori: e.target.value })}
                      className="w-full px-3 py-2 border border-outline-variant rounded-lg focus:ring-primary focus:border-primary font-body-md bg-surface-container-lowest focus:outline-none">
                      {kbCategories.filter(k => k !== 'Semua').map((k) => (<option key={k} value={k}>{k}</option>))}
                    </select>
                  </div>
                  <div>
                    <label className="block font-label-md text-label-md text-on-surface mb-1">Teks Informasi (Lengkap) *</label>
                    <textarea required value={kbForm.teks} onChange={(e) => setKbForm({ ...kbForm, teks: e.target.value })}
                      className="w-full px-3 py-2 border border-outline-variant rounded-lg focus:ring-primary focus:border-primary font-body-md bg-surface-container-lowest focus:outline-none resize-none"
                      rows={6} placeholder="Tulis atau paste dokumen pengetahuan bisnis di sini..." />
                  </div>
                  <div className="flex gap-3 pt-2">
                    <button type="submit" className="flex-1 bg-primary text-on-primary py-2.5 rounded-lg font-label-md hover:opacity-90 transition-opacity">
                      Latih & Embed AI
                    </button>
                    <button type="button" onClick={() => setShowKbForm(false)}
                      className="px-6 py-2.5 border border-outline-variant rounded-lg text-on-surface-variant font-label-md hover:bg-surface-container-high transition-colors">
                      Batal
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* KB Entries List */}
          {kbLoading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
            </div>
          ) : filteredKb.length === 0 ? (
            <div className="border-2 border-dashed border-outline-variant rounded-xl p-8 flex flex-col items-center justify-center text-center">
              <Lightbulb size={32} className="text-outline-variant mb-2" />
              <p className="font-bold text-on-surface">Peta pengetahuan AI kosong</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {filteredKb.map((entry) => {
                const Icon = getKbIcon(entry.kategori);
                return (
                  <div key={entry.id} className={`group bg-surface-container-lowest border border-neutral-200 rounded-xl p-4 shadow-sm hover:shadow transition-shadow flex flex-col md:flex-row items-start md:items-center justify-between gap-4 ${!entry.is_active ? 'opacity-50' : ''}`}>
                    <div className="flex items-start gap-4 flex-1 min-w-0">
                      <div className="mt-1 w-9 h-9 rounded-lg bg-surface-cream border border-primary-fixed flex items-center justify-center text-primary shrink-0">
                        <Icon size={18} />
                      </div>
                      <div className="space-y-1 min-w-0 font-body-md">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-bold text-on-surface text-sm">{entry.judul}</h4>
                          <span className="bg-surface-container px-2 py-0.5 rounded text-[9px] font-bold text-on-secondary-container uppercase">
                            {entry.kategori || 'Umum'}
                          </span>
                          {entry.has_embedding && (
                            <span className="text-[9px] text-green-600 font-bold bg-green-50 px-1.5 py-0.5 rounded border border-green-200 font-mono">EMBEDDED</span>
                          )}
                        </div>
                        <p className="text-on-surface-variant text-xs line-clamp-1 italic">
                          &ldquo;{entry.potongan_teks}&rdquo;
                        </p>
                        <div className="flex items-center gap-3 font-caption text-outline-variant text-[10px]">
                          <span className="flex items-center gap-1">
                            <Clock size={12} />
                            Terkonfigurasi {formatKbDate(entry.tanggal_upload)}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 w-full md:w-auto border-t md:border-0 pt-2 md:pt-0">
                      <div className="flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full ${entry.is_active ? 'bg-green-500 animate-pulse' : 'bg-gray-300'}`} />
                        <span className="font-label-md text-[10px] text-on-surface font-semibold">{entry.is_active ? 'Aktif' : 'Nonaktif'}</span>
                      </div>
                      <div className="flex gap-1">
                        <button onClick={() => handleToggleKb(entry.id)} className="p-1.5 hover:bg-surface-container rounded text-on-surface-variant transition-colors" title={entry.is_active ? 'Nonaktifkan' : 'Aktifkan'}>
                          {entry.is_active ? <X size={16} /> : <Upload size={16} className="text-green-600" />}
                        </button>
                        <button onClick={() => handleDeleteKb(entry.id)} className="p-1.5 hover:bg-error-container hover:text-error rounded text-on-surface-variant transition-colors">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {tab === 'menu' && (
        <div className="bg-surface-container-lowest border border-neutral-200 rounded-xl shadow-sm overflow-hidden">
          <div className="p-4 border-b border-outline-variant/10">
            <h2 className="font-headline-sm text-headline-sm text-on-surface">Prompt Cepat /pesan</h2>
            <p className="mt-1 text-sm text-on-surface-variant">Label aktif di sini akan muncul sebagai quick prompt di halaman pemesanan publik.</p>
          </div>
          <form onSubmit={handleAddMenuItem} className="grid gap-3 border-b border-outline-variant/10 bg-surface-cream/50 p-4 md:grid-cols-[1fr_120px_auto]">
            <input value={menuForm.label} onChange={(e) => setMenuForm({ ...menuForm, label: e.target.value })} placeholder="Contoh: Paket hemat 50 ribu" className="rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 font-body-md outline-none focus:border-primary" />
            <input type="number" value={menuForm.sort_order} onChange={(e) => setMenuForm({ ...menuForm, sort_order: Number(e.target.value) })} className="rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 font-body-md outline-none focus:border-primary" />
            <button type="submit" className="rounded-lg bg-primary px-4 py-2 font-label-md text-on-primary">Tambah Prompt</button>
          </form>
          <div className="divide-y divide-outline-variant/10">
            {menuItems.length === 0 ? (
              <div className="p-8 text-center text-on-surface-variant">Belum ada prompt publik. Halaman /pesan akan memakai fallback default.</div>
            ) : menuItems.map((item) => (
              <div key={item.id} className="flex items-center justify-between gap-4 p-4">
                <div>
                  <p className="font-bold text-on-surface">{item.label}</p>
                  <p className="text-xs text-on-surface-variant">Urutan {item.sort_order} • {item.action}</p>
                </div>
                <button onClick={() => handleToggleMenuItem(item)} className="rounded-lg border border-outline-variant px-3 py-2 text-sm font-bold text-on-surface-variant" type="button">
                  {item.is_active ? 'Aktif' : 'Nonaktif'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* --- TAB 3: CONVERSATION LOGS --- */}
      {tab === 'logs' && (
        <div className="bg-surface-container-lowest border border-neutral-200 rounded-xl shadow-sm overflow-hidden">
          <div className="p-4 border-b border-outline-variant/10">
            <p className="text-sm text-on-surface-variant font-body-md">Riwayat respons model dan token chatbot terbaru (50 logs)</p>
          </div>
          {logs.length === 0 ? (
            <div className="p-12 text-center text-on-surface-variant font-body-md">
              <MessageSquare size={48} className="mx-auto mb-3 text-outline-variant" />
              <p>Belum ada percakapan chatbot terarsip</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs font-body-md">
                <thead>
                  <tr className="bg-surface-container text-on-surface-variant font-label-md">
                    <th className="text-left px-4 py-3">Waktu</th>
                    <th className="text-left px-4 py-3">Pelanggan</th>
                    <th className="text-left px-4 py-3">Pesan</th>
                    <th className="text-center px-4 py-3">Sumber Balasan</th>
                    <th className="text-right px-4 py-3">Token</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/10">
                  {logs.map((log) => (
                    <tr key={log.id} className="hover:bg-surface-cream transition-colors">
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                        {new Date(log.timestamp).toLocaleString('id-ID', { timeZone: 'Asia/Makassar' })}
                      </td>
                      <td className="px-4 py-3 font-mono">{log.no_wa_pelanggan}</td>
                      <td className="px-4 py-3 max-w-xs">
                        <p className="truncate text-on-surface font-semibold">{log.user_message}</p>
                        {log.bot_response && (
                          <p className="truncate text-on-surface-variant text-[11px] mt-0.5">→ {log.bot_response}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          log.sumber === 'rule' ? 'bg-green-100 text-green-700 border border-green-200' :
                          log.sumber === 'groq' ? 'bg-orange-100 text-orange-700 border border-orange-200' :
                          log.sumber === 'gemini' ? 'bg-blue-100 text-blue-700 border border-blue-200' :
                          'bg-red-100 text-red-700 border border-red-200'
                        }`}>
                          {log.sumber.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-on-surface-variant">{log.tokens_used || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* --- TAB 4: ANALYTICS --- */}
      {tab === 'analytics' && (
        <div className="space-y-4">
          <div className="bg-surface-container-lowest border border-neutral-200 rounded-xl p-4">
            <p className="text-sm text-on-surface-variant font-body-md">Performa chatbot harian — sumber respon, top pertanyaan, dan efektivitas AI</p>
          </div>
          <BotPerformancePanel />
        </div>
      )}
    </div>
  );
}
