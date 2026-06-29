'use client';

import { useState, useEffect } from 'react';
import { Send, Plus, FileText, Trash2, Clock, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { getCampaigns, createCampaign, sendCampaign, deleteCampaign, getTemplates, createTemplate, deleteTemplate } from '@/actions/broadcast';
import { useToast } from '@/components/ui/toast';
import { ConfirmModal } from '@/components/ui/modal';
import { Modal } from '@/components/ui/modal';

const TAG_OPTIONS = ['VIP', 'Prospek', 'Komplain', 'Pelanggan Baru', 'Butuh Follow-up', 'Tidak Aktif', 'Reseller', 'Dropshipper'];
const KATEGORI_TEMPLATE = ['Promo', 'Notifikasi', 'Ucapan', 'Lainnya'];

export default function BroadcastPage() {
  const { addToast } = useToast();
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'campaign' | 'template'>('campaign');
  const [showNewCampaign, setShowNewCampaign] = useState(false);
  const [showNewTemplate, setShowNewTemplate] = useState(false);
  const [sendingId, setSendingId] = useState<number | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: number; type: 'campaign' | 'template' } | null>(null);

  const [formCampaign, setFormCampaign] = useState({ nama: '', pesan: '', target_tags: [] as string[] });
  const [formTemplate, setFormTemplate] = useState({ nama: '', konten: '', kategori: 'Promo' });

  useEffect(() => { fetchData().catch(console.error); }, []);

  async function fetchData() {
    setLoading(true);
    const [c, t] = await Promise.all([getCampaigns(), getTemplates()]);
    setCampaigns(c);
    setTemplates(t);
    setLoading(false);
  }

  async function handleCreateCampaign(e: React.FormEvent) {
    e.preventDefault();
    if (!formCampaign.nama || !formCampaign.pesan) return;
    const res = await createCampaign(formCampaign);
    addToast(res.success ? 'success' : 'error', res.message);
    if (res.success) {
      setShowNewCampaign(false);
      setFormCampaign({ nama: '', pesan: '', target_tags: [] });
      fetchData();
    }
  }

  async function handleSendCampaign(id: number) {
    setSendingId(id);
    const res = await sendCampaign(id);
    addToast(res.success ? 'success' : 'error', res.message);
    setSendingId(null);
    fetchData();
  }

  async function handleCreateTemplate(e: React.FormEvent) {
    e.preventDefault();
    if (!formTemplate.nama || !formTemplate.konten) return;
    const res = await createTemplate(formTemplate);
    addToast(res.success ? 'success' : 'error', res.message);
    if (res.success) {
      setShowNewTemplate(false);
      setFormTemplate({ nama: '', konten: '', kategori: 'Promo' });
      fetchData();
    }
  }

  async function handleDelete() {
    if (!deleteConfirm) return;
    const res = deleteConfirm.type === 'campaign'
      ? await deleteCampaign(deleteConfirm.id)
      : await deleteTemplate(deleteConfirm.id);
    addToast(res.success ? 'success' : 'error', res.message);
    setDeleteConfirm(null);
    fetchData();
  }

  function toggleTag(tag: string) {
    setFormCampaign(f => ({
      ...f,
      target_tags: f.target_tags.includes(tag)
        ? f.target_tags.filter(t => t !== tag)
        : [...f.target_tags, tag],
    }));
  }

  function formatDate(ts: string) {
    return new Date(ts + 'Z').toLocaleString('id-ID', { timeZone: 'Asia/Makassar' });
  }

  return (
    <div className="max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-headline-lg text-headline-lg text-on-surface">Broadcast</h1>
          <p className="text-on-surface-variant font-body-md mt-1">Kirim pesan massal ke pelanggan via WhatsApp</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-surface-container-lowest border border-neutral-200 rounded-xl p-1 mb-gutter">
        {[
          { key: 'campaign' as const, label: 'Campaign', icon: Send, count: campaigns.length },
          { key: 'template' as const, label: 'Template', icon: FileText, count: templates.length },
        ].map(t => {
          const Icon = t.icon;
          const isActive = tab === t.key;
          return (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`flex items-center gap-2 flex-1 justify-center px-4 py-2.5 rounded-lg font-label-md text-label-md transition-all ${
                isActive ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant hover:bg-surface-container'
              }`}>
              <Icon size={16} /> {t.label}
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${isActive ? 'bg-white/20' : 'bg-surface-container-high'}`}>{t.count}</span>
            </button>
          );
        })}
      </div>

      {tab === 'campaign' && (
        <>
          <button onClick={() => setShowNewCampaign(true)}
            className="mb-4 flex items-center gap-2 px-4 py-2.5 bg-primary text-on-primary rounded-lg font-label-md hover:opacity-90 transition-opacity">
            <Plus size={16} /> Campaign Baru
          </button>

          {loading ? (
            <div className="space-y-3">
              {[1,2,3].map(i => <div key={i} className="animate-pulse h-24 bg-surface-container-high rounded-xl" />)}
            </div>
          ) : campaigns.length === 0 ? (
            <div className="bg-surface-container-lowest border border-neutral-200 rounded-xl p-12 text-center">
              <Send size={48} className="mx-auto mb-3 text-outline-variant" />
              <p className="font-body-md text-on-surface-variant">Belum ada campaign</p>
            </div>
          ) : (
            <div className="space-y-3">
              {campaigns.map(c => (
                <div key={c.id} className="bg-surface-container-lowest border border-neutral-200 rounded-xl p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-headline-sm text-headline-sm text-on-surface truncate">{c.nama}</h3>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-label-md ${
                          c.status === 'sent' ? 'bg-green-100 text-green-700' :
                          c.status === 'sending' ? 'bg-blue-100 text-blue-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>{c.status === 'sent' ? 'Terkirim' : c.status === 'sending' ? 'Mengirim...' : 'Draft'}</span>
                      </div>
                      <p className="font-body-md text-body-md text-on-surface-variant line-clamp-2 mb-2 whitespace-pre-wrap">{c.pesan}</p>
                      <div className="flex flex-wrap items-center gap-3 text-caption text-caption text-on-surface-variant">
                        <span className="flex items-center gap-1"><Clock size={12} /> {formatDate(c.created_at)}</span>
                        <span className="flex items-center gap-1"><CheckCircle size={12} /> {c.sent_count}/{c.total_count} terkirim</span>
                        {c.target_tags && c.target_tags !== '[]' && (
                          <span className="text-primary">Target: {JSON.parse(c.target_tags).join(', ')}</span>
                        )}
                        {c.target_tags === '[]' && <span>Target: Semua pelanggan</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {c.status === 'draft' && (
                        <button onClick={() => handleSendCampaign(c.id)} disabled={sendingId === c.id}
                          className="flex items-center gap-1 px-3 py-1.5 bg-primary text-on-primary rounded-lg font-label-md text-label-md hover:opacity-90 transition-opacity disabled:opacity-50">
                          {sendingId === c.id ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                          Kirim
                        </button>
                      )}
                      <button onClick={() => setDeleteConfirm({ id: c.id, type: 'campaign' })}
                        className="p-1.5 text-on-surface-variant hover:text-error rounded-lg hover:bg-error-container transition-colors">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {tab === 'template' && (
        <>
          <button onClick={() => setShowNewTemplate(true)}
            className="mb-4 flex items-center gap-2 px-4 py-2.5 bg-primary text-on-primary rounded-lg font-label-md hover:opacity-90 transition-opacity">
            <Plus size={16} /> Template Baru
          </button>

          {templates.length === 0 ? (
            <div className="bg-surface-container-lowest border border-neutral-200 rounded-xl p-12 text-center">
              <FileText size={48} className="mx-auto mb-3 text-outline-variant" />
              <p className="font-body-md text-on-surface-variant">Belum ada template</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-gutter">
              {templates.map(t => (
                <div key={t.id} className="bg-surface-container-lowest border border-neutral-200 rounded-xl p-5">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h3 className="font-headline-sm text-headline-sm text-on-surface">{t.nama}</h3>
                      <span className="inline-block px-2 py-0.5 rounded-full bg-surface-container text-on-surface-variant text-[10px] font-label-md mt-1">{t.kategori}</span>
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
        </>
      )}

      {/* New Campaign Modal */}
      <Modal open={showNewCampaign} onClose={() => setShowNewCampaign(false)} title="Campaign Baru">
        <form onSubmit={handleCreateCampaign} className="space-y-4">
          <div>
            <label className="block font-label-md text-label-md text-on-surface mb-1">Nama Campaign</label>
            <input value={formCampaign.nama} onChange={e => setFormCampaign(f => ({ ...f, nama: e.target.value }))} required
              className="w-full px-3 py-2 bg-surface-container-lowest border border-outline-variant rounded-lg font-body-md focus:ring-primary focus:border-primary"
              placeholder="Contoh: Promo Akhir Bulan" />
          </div>
          <div>
            <label className="block font-label-md text-label-md text-on-surface mb-1">Pesan WhatsApp</label>
            <textarea value={formCampaign.pesan} onChange={e => setFormCampaign(f => ({ ...f, pesan: e.target.value }))} required rows={5}
              className="w-full px-3 py-2 bg-surface-container-lowest border border-outline-variant rounded-lg font-body-md focus:ring-primary focus:border-primary resize-none"
              placeholder="Tulis pesan yang akan dikirim..." />
          </div>
          <div>
            <label className="block font-label-md text-label-md text-on-surface mb-2">Target (tags)</label>
            <p className="font-caption text-caption text-on-surface-variant mb-2">Kosongkan jika ingin kirim ke semua pelanggan</p>
            <div className="flex flex-wrap gap-2">
              {TAG_OPTIONS.map(tag => (
                <button key={tag} type="button" onClick={() => toggleTag(tag)}
                  className={`px-3 py-1.5 rounded-full font-label-md text-label-md border transition-colors ${
                    formCampaign.target_tags.includes(tag)
                      ? 'bg-primary text-on-primary border-primary'
                      : 'bg-surface-container-high text-on-surface-variant border-outline-variant hover:bg-outline-variant'
                  }`}>{tag}</button>
              ))}
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="submit" className="flex-1 bg-primary text-on-primary py-2.5 rounded-lg font-label-md hover:opacity-90 transition-opacity">
              Buat Campaign
            </button>
            <button type="button" onClick={() => setShowNewCampaign(false)}
              className="px-6 py-2.5 border border-outline-variant rounded-lg text-on-surface-variant font-label-md hover:bg-surface-container-high transition-colors">Batal</button>
          </div>
        </form>
      </Modal>

      {/* New Template Modal */}
      <Modal open={showNewTemplate} onClose={() => setShowNewTemplate(false)} title="Template Baru">
        <form onSubmit={handleCreateTemplate} className="space-y-4">
          <div>
            <label className="block font-label-md text-label-md text-on-surface mb-1">Nama Template</label>
            <input value={formTemplate.nama} onChange={e => setFormTemplate(f => ({ ...f, nama: e.target.value }))} required
              className="w-full px-3 py-2 bg-surface-container-lowest border border-outline-variant rounded-lg font-body-md focus:ring-primary focus:border-primary"
              placeholder="Contoh: Promo Akhir Pekan" />
          </div>
          <div>
            <label className="block font-label-md text-label-md text-on-surface mb-1">Kategori</label>
            <select value={formTemplate.kategori} onChange={e => setFormTemplate(f => ({ ...f, kategori: e.target.value }))}
              className="w-full px-3 py-2 bg-surface-container-lowest border border-outline-variant rounded-lg font-body-md focus:ring-primary focus:border-primary">
              {KATEGORI_TEMPLATE.map(k => <option key={k} value={k}>{k}</option>)}
            </select>
          </div>
          <div>
            <label className="block font-label-md text-label-md text-on-surface mb-1">Konten Template</label>
            <textarea value={formTemplate.konten} onChange={e => setFormTemplate(f => ({ ...f, konten: e.target.value }))} required rows={5}
              className="w-full px-3 py-2 bg-surface-container-lowest border border-outline-variant rounded-lg font-body-md focus:ring-primary focus:border-primary resize-none"
              placeholder="Tulis template pesan..." />
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
        onConfirm={handleDelete}
        title={`Hapus ${deleteConfirm?.type === 'campaign' ? 'Campaign' : 'Template'}`}
        message="Apakah Anda yakin ingin menghapus item ini?"
        confirmLabel="Hapus"
        variant="danger"
      />
    </div>
  );
}
