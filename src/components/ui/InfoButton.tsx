'use client';

import { useState } from 'react';
import { Info, X } from 'lucide-react';

type InfoButtonProps = {
  title: string;
  description: string;
  usage?: string;
  align?: 'left' | 'right';
};

export function InfoButton({ title, description, usage, align = 'right' }: InfoButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative inline-flex">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label={`Info ${title}`}
        className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-outline-variant bg-white text-on-surface-variant shadow-sm transition hover:border-primary/40 hover:bg-surface-container hover:text-primary"
      >
        <Info size={16} />
      </button>
      {open && (
        <div className={`absolute top-11 z-40 w-80 rounded-2xl border border-outline-variant bg-white p-4 text-left shadow-[0_18px_50px_rgba(15,23,42,0.14)] ${align === 'right' ? 'right-0' : 'left-0'}`}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-on-surface">{title}</p>
              <p className="mt-2 text-sm leading-6 text-on-surface-variant">{description}</p>
            </div>
            <button type="button" onClick={() => setOpen(false)} className="rounded-full p-1 text-on-surface-variant hover:bg-surface-container">
              <X size={14} />
            </button>
          </div>
          {usage && (
            <div className="mt-3 rounded-xl bg-surface-cream p-3 text-xs leading-5 text-on-surface-variant">
              <span className="font-semibold text-on-surface">Cara pakai: </span>{usage}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
