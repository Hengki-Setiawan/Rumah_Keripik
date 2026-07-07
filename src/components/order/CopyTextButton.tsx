'use client';

import { useState } from 'react';
import { Copy } from 'lucide-react';

export function CopyTextButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    await navigator.clipboard?.writeText(value).catch(() => undefined);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }
  return <button type="button" onClick={copy} className="inline-flex items-center gap-1 rounded-lg border border-[#e5e7eb] px-2 py-1 text-xs font-medium text-[#111827] hover:bg-[#f3f4f6]"><Copy size={14} /> {copied ? 'Tersalin' : 'Copy'}</button>;
}
