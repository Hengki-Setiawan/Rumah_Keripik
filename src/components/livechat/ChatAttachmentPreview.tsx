'use client';

import { Image as ImageIcon, X, ZoomIn } from 'lucide-react';
import { useState } from 'react';

interface ChatAttachmentPreviewProps {
  /** URL gambar atau base64 data URL */
  src: string;
  caption?: string;
  timestamp?: string;
  /** Nama pengirim (pelanggan) */
  sender?: string;
  onClose?: () => void;
}

export function ChatAttachmentPreview({
  src,
  caption,
  timestamp,
  sender,
  onClose,
}: ChatAttachmentPreviewProps) {
  const [fullscreen, setFullscreen] = useState(false);
  const [imgError, setImgError] = useState(false);

  return (
    <>
      {/* Inline Preview (dalam bubble chat) */}
      <div className="max-w-xs rounded-xl overflow-hidden border border-outline-variant/20 bg-surface-container">
        {imgError ? (
          <div className="flex items-center justify-center gap-2 p-6 text-on-surface-variant">
            <ImageIcon size={24} className="text-outline-variant" />
            <span className="text-sm">Gambar tidak tersedia</span>
          </div>
        ) : (
          <div className="relative group cursor-zoom-in" onClick={() => setFullscreen(true)}>
            <img
              src={src}
              alt={caption || 'Attachment'}
              className="w-full max-h-64 object-cover"
              onError={() => setImgError(true)}
            />
            {/* Overlay on hover */}
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all flex items-center justify-center">
              <ZoomIn
                size={28}
                className="text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-md"
              />
            </div>
          </div>
        )}

        {/* Caption & timestamp */}
        {(caption || timestamp || sender) && (
          <div className="px-3 py-2 space-y-0.5">
            {sender && (
              <p className="text-[10px] font-semibold text-primary">{sender}</p>
            )}
            {caption && (
              <p className="text-xs text-on-surface-variant">{caption}</p>
            )}
            {timestamp && (
              <p className="text-[10px] text-on-surface-variant/60">{timestamp}</p>
            )}
          </div>
        )}
      </div>

      {/* Fullscreen Lightbox */}
      {fullscreen && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setFullscreen(false)}
        >
          <button
            onClick={() => setFullscreen(false)}
            className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
          >
            <X size={24} />
          </button>
          <img
            src={src}
            alt={caption || 'Attachment'}
            className="max-w-full max-h-full object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
          {caption && (
            <p className="absolute bottom-6 text-white/80 text-sm bg-black/50 px-4 py-2 rounded-full">
              {caption}
            </p>
          )}
        </div>
      )}
    </>
  );
}
