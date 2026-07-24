'use client';

import { useEffect, useState } from 'react';
import { BookOpen, CheckCircle, XCircle, Sparkles, MessageSquare, ThumbsDown, Edit3, ArrowRight } from 'lucide-react';

interface SkillDraftItem {
  id: string;
  sourceType: string;
  sourceConversationExcerpt: string | null;
  draftMarkdown: string;
  proposedName: string;
  proposedDescription: string;
  status: 'pending_review' | 'approved' | 'rejected';
  createdAt: string;
}

export default function TeachAgentPage() {
  const [drafts, setDrafts] = useState<SkillDraftItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDraft, setSelectedDraft] = useState<SkillDraftItem | null>(null);

  useEffect(() => {
    fetch('/api/admin/skill-drafts')
      .then((res) => res.json())
      .then((data) => {
        if (data.ok) setDrafts(data.drafts);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleReview = async (id: string, action: 'approve' | 'reject') => {
    try {
      const res = await fetch('/api/admin/skill-drafts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action }),
      });
      const json = await res.json();
      if (json.ok) {
        setDrafts((prev) => prev.map((d) => (d.id === id ? { ...d, status: action === 'approve' ? 'approved' : 'rejected' } : d)));
        if (selectedDraft?.id === id) setSelectedDraft(null);
      }
    } catch {}
  };

  if (loading) {
    return <div className="p-6 text-amber-800">Memuat Mode Ajari Agent AI...</div>;
  }

  return (
    <div className="p-6 space-y-6 bg-amber-50/30 min-h-screen">
      <div className="flex justify-between items-center bg-white p-5 rounded-xl border border-amber-200 shadow-sm">
        <div>
          <h1 className="text-2xl font-extrabold text-amber-950 flex items-center gap-2">
            <BookOpen className="text-amber-600" /> Mode Ajari Agent AI (Human-in-the-Loop)
          </h1>
          <p className="text-xs text-amber-800 mt-1">
            Tinjau koreksi admin & usulan skill otomatis dari percakapan nyata sebelum diaktifkan ke agent loop.
          </p>
        </div>
        <div className="flex gap-2">
          <span className="px-3 py-1 bg-amber-100 text-amber-800 text-xs font-semibold rounded-full">
            {drafts.filter((d) => d.status === 'pending_review').length} Menunggu Review
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left: Skill Drafts List */}
        <div className="bg-white p-5 rounded-xl border border-amber-200 shadow-sm space-y-4">
          <h2 className="font-bold text-amber-900 text-sm uppercase tracking-wider flex items-center gap-2">
            <Sparkles size={16} className="text-amber-600" /> Usulan Skill & Koreksi Admin
          </h2>

          {drafts.length === 0 ? (
            <div className="text-center py-10 text-amber-700 text-sm">
              Belum ada usulan skill baru. Semua interaksi berjalan lancar! 🎉
            </div>
          ) : (
            drafts.map((draft) => (
              <div
                key={draft.id}
                onClick={() => setSelectedDraft(draft)}
                className={`p-4 rounded-lg border cursor-pointer transition ${
                  selectedDraft?.id === draft.id
                    ? 'border-amber-500 bg-amber-50/50'
                    : 'border-gray-200 hover:border-amber-300'
                }`}
              >
                <div className="flex justify-between items-start">
                  <span className="font-bold text-amber-900 text-sm">{draft.proposedName}</span>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      draft.status === 'approved'
                        ? 'bg-emerald-100 text-emerald-800'
                        : draft.status === 'rejected'
                        ? 'bg-red-100 text-red-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {draft.status.toUpperCase()}
                  </span>
                </div>
                <p className="text-xs text-gray-600 mt-1 line-clamp-2">{draft.proposedDescription}</p>
                <div className="text-[11px] text-gray-400 mt-2 flex justify-between">
                  <span>Sumber: {draft.sourceType}</span>
                  <span>{new Date(draft.createdAt).toLocaleDateString('id-ID')}</span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Right: Draft Detail & Editor */}
        <div className="bg-white p-5 rounded-xl border border-amber-200 shadow-sm">
          {selectedDraft ? (
            <div className="space-y-4">
              <div className="flex justify-between items-center border-b pb-3">
                <h3 className="font-bold text-amber-950 text-base">{selectedDraft.proposedName}</h3>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleReview(selectedDraft.id, 'approve')}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg flex items-center gap-1 shadow-sm"
                  >
                    <CheckCircle size={14} /> Approve & Aktifkan
                  </button>
                  <button
                    onClick={() => handleReview(selectedDraft.id, 'reject')}
                    className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-lg flex items-center gap-1 shadow-sm"
                  >
                    <XCircle size={14} /> Tolak
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-700">Deskripsi Pemicu Model:</label>
                <p className="text-xs bg-amber-50 p-2.5 rounded border border-amber-200 text-amber-900 mt-1">
                  {selectedDraft.proposedDescription}
                </p>
              </div>

              {selectedDraft.sourceConversationExcerpt && (
                <div>
                  <label className="text-xs font-semibold text-gray-700">Kutipan Percakapan Asal:</label>
                  <p className="text-xs bg-gray-50 p-2.5 rounded border text-gray-700 mt-1 font-mono">
                    {selectedDraft.sourceConversationExcerpt}
                  </p>
                </div>
              )}

              <div>
                <label className="text-xs font-semibold text-gray-700">Isi Instruksi SKILL.md:</label>
                <textarea
                  readOnly
                  value={selectedDraft.draftMarkdown}
                  className="w-full h-64 text-xs font-mono p-3 bg-gray-900 text-emerald-400 rounded-lg mt-1 resize-none"
                />
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full py-20 text-gray-400 space-y-2">
              <BookOpen size={32} />
              <p className="text-xs font-medium">Pilih usulan skill di sebelah kiri untuk meninjau & mengaktifkan.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
