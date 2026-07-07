'use client';

import { useState } from 'react';

export function ResolveFailedConversationButton({ id }: { id: number }) {
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function resolve() {
    setLoading(true);
    const res = await fetch(`/api/admin/failed-conversations/${id}/resolve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ note }),
    });
    setLoading(false);
    if (res.ok) setDone(true);
  }

  if (done) return <span className="rounded-xl bg-green-50 px-4 py-2 text-sm font-medium text-green-700">Resolved</span>;
  return (
    <div className="min-w-56 space-y-2">
      <textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Catatan resolusi" className="min-h-20 w-full rounded-xl border border-outline-variant p-2 text-sm outline-none focus:border-primary/40" />
      <button onClick={resolve} disabled={loading} className="w-full rounded-xl bg-primary px-4 py-2 text-sm font-medium text-on-primary disabled:opacity-60">{loading ? 'Menyimpan...' : 'Mark Resolved'}</button>
    </div>
  );
}
