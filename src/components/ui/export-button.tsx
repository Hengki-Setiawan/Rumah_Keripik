'use client';

import { useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { useToast } from './toast';

interface ExportButtonProps {
  label?: string;
  action: () => Promise<{ success: boolean; data?: string; filename?: string; message?: string }>;
}

export function ExportButton({ label = 'Export CSV', action }: ExportButtonProps) {
  const { addToast } = useToast();
  const [loading, setLoading] = useState(false);

  async function handleExport() {
    setLoading(true);
    const res = await action();
    setLoading(false);

    if (!res.success || !res.data) {
      addToast('error', res.message || 'Gagal export');
      return;
    }

    const blob = new Blob([res.data], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = res.filename || 'export.csv';
    a.click();
    URL.revokeObjectURL(url);
    addToast('success', `${res.filename} berhasil didownload`);
  }

  return (
    <button
      onClick={handleExport}
      disabled={loading}
      className="flex items-center gap-2 px-3 py-2 border border-outline-variant rounded-lg text-on-surface-variant font-label-md text-label-md hover:bg-surface-container-high transition-colors disabled:opacity-50"
    >
      {loading ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
      {label}
    </button>
  );
}
