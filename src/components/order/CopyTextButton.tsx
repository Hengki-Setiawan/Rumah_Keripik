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
  return <button type="button" onClick={copy} className="inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-xs font-black text-[#8d4b00]"><Copy size={14} /> {copied ? 'Tersalin' : 'Copy'}</button>;
}
