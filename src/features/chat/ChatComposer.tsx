'use client';

import { FormEvent, useState, useRef } from 'react';
import { Loader2, SendHorizonal, Sparkles, Mic, Square } from 'lucide-react';

export function ChatComposer({
  disabled,
  idle = false,
  value,
  onValueChange,
  onSend,
}: {
  disabled?: boolean;
  idle?: boolean;
  value: string;
  onValueChange: (value: string) => void;
  onSend: (message: string) => Promise<void> | void;
}) {
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const text = value.trim();
    if (!text || disabled) return;
    onValueChange('');
    await onSend(text);
  }

  async function startRecording() {
    if (disabled || isTranscribing) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        if (audioBlob.size < 1000) {
          setIsTranscribing(false);
          setIsRecording(false);
          return;
        }

        setIsTranscribing(true);
        try {
          const formData = new FormData();
          formData.append('audio', audioBlob, 'voice_order.webm');

          const res = await fetch('/api/ai/transcribe', {
            method: 'POST',
            body: formData,
          });

          if (res.ok) {
            const data = await res.json();
            if (data?.text?.trim()) {
              const transcribedText = data.text.trim();
              onValueChange(transcribedText);
            }
          }
        } catch (err) {
          console.warn('[VOICE_TRANSCRIBE_ERROR]', err);
        } finally {
          setIsTranscribing(false);
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.warn('[RECORDING_PERMISSION_DENIED]', err);
      alert('Izin mikrofon diperlukan untuk merekam pesan suara.');
    }
  }

  function stopRecording() {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      data-testid={idle ? 'chat-composer-idle' : 'chat-composer'}
      className={`rounded-[1.5rem] border border-[#f0dfca] bg-[rgba(255,250,244,0.92)] p-1.5 shadow-[0_18px_54px_rgba(47,36,28,0.1)] backdrop-blur-2xl transition focus-within:border-[#e0c5a8] focus-within:shadow-[0_22px_66px_rgba(47,36,28,0.12)] md:rounded-[1.7rem] ${
        idle ? 'scale-100' : ''
      }`}
    >
      <div className="flex items-center gap-2">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-[#c55a2b] md:h-10 md:w-10">
          <Sparkles size={16} />
        </span>

        <div className="min-w-0 flex-1">
          {isRecording ? (
            <div className="flex items-center gap-2 px-2 py-2 text-sm text-[#c55a2b]">
              <span className="h-2.5 w-2.5 animate-ping rounded-full bg-red-500" />
              <span className="font-medium animate-pulse">Merekam suara pesananmu...</span>
            </div>
          ) : isTranscribing ? (
            <div className="flex items-center gap-2 px-2 py-2 text-sm text-[#8c6b4f]">
              <Loader2 size={16} className="animate-spin text-[#c55a2b]" />
              <span>Memproses suara dengan Whisper AI...</span>
            </div>
          ) : (
            <textarea
              data-testid="chat-input"
              value={value}
              onChange={(event) => onValueChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  submit(event as unknown as FormEvent);
                }
              }}
              rows={1}
              placeholder="Tanya stok, harga, atau bicara pesan keripik..."
              className="max-h-32 min-h-10 w-full resize-none bg-transparent px-1 py-2.5 text-[14px] leading-6 text-[#2f241c] outline-none placeholder:text-[#9b8772]"
            />
          )}
        </div>

        {/* Tombol Mikrofon Voice Note */}
        {isRecording ? (
          <button
            type="button"
            onClick={stopRecording}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-red-600 text-white shadow-lg transition hover:bg-red-700 md:h-11 md:w-11"
            title="Selesai merekam"
            aria-label="Selesai merekam"
          >
            <Square size={16} className="fill-current" />
          </button>
        ) : !value.trim() ? (
          <button
            type="button"
            onClick={startRecording}
            disabled={disabled || isTranscribing}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#f4e8dc] text-[#c55a2b] transition hover:scale-[1.04] hover:bg-[#ebd9c7] disabled:opacity-50 md:h-11 md:w-11"
            title="Pesan via Pesan Suara"
            aria-label="Rekam pesan suara"
          >
            <Mic size={18} />
          </button>
        ) : null}

        {/* Tombol Kirim */}
        <button
          type="submit"
          data-testid="chat-send-button"
          disabled={disabled || !value.trim() || isRecording || isTranscribing}
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#c55a2b] text-white shadow-[0_12px_28px_rgba(197,90,43,0.16)] transition hover:scale-[1.02] hover:bg-[#ae4d23] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c55a2b]/20 disabled:cursor-not-allowed disabled:bg-[#d8c8b8] disabled:shadow-none md:h-11 md:w-11"
          aria-label="Kirim pesan"
        >
          {disabled || isTranscribing ? (
            <Loader2 size={17} className="animate-spin" />
          ) : (
            <SendHorizonal size={17} />
          )}
        </button>
      </div>
    </form>
  );
}
