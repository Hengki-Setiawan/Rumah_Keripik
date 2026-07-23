'use client';

import { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';

export function PwaInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    // Register Service Worker
    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowPrompt(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setShowPrompt(false);
    }
    setDeferredPrompt(null);
  };

  if (!showPrompt) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:max-w-sm z-50 bg-amber-950/90 text-amber-50 backdrop-blur-md p-4 rounded-xl border border-amber-500/30 shadow-2xl animate-in slide-in-from-bottom-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="bg-amber-500/20 p-2.5 rounded-lg border border-amber-500/40 text-amber-400">
            <Download className="w-5 h-5 animate-bounce" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-amber-200">Install Rumah Keripik</h4>
            <p className="text-xs text-amber-300/80 mt-0.5">
              Simpan ke Layar Utama HP untuk pemesanan cepat & tanpa kuota lebih!
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowPrompt(false)}
          className="text-amber-400/60 hover:text-amber-200 p-1 transition-colors"
          aria-label="Tutup"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="mt-3 flex items-center justify-end gap-2">
        <button
          onClick={() => setShowPrompt(false)}
          className="px-3 py-1.5 text-xs text-amber-300 hover:text-amber-100 transition-colors"
        >
          Nanti Saja
        </button>
        <button
          onClick={handleInstallClick}
          className="px-3.5 py-1.5 text-xs font-semibold bg-amber-500 hover:bg-amber-400 text-amber-950 rounded-lg shadow-md transition-colors flex items-center gap-1.5"
        >
          <Download className="w-3.5 h-3.5" />
          Install Sekarang
        </button>
      </div>
    </div>
  );
}
