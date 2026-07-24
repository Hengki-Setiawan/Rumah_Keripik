'use client';

interface StopButtonProps {
  onStop: () => void;
  visible: boolean;
}

export function StopButton({ onStop, visible }: StopButtonProps) {
  if (!visible) return null;

  return (
    <button
      onClick={onStop}
      className="flex items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100 transition-colors"
      aria-label="Hentikan AI"
    >
      <span className="flex h-3 w-3 items-center justify-center">
        <span className="block h-2 w-2 rounded-sm bg-red-500" />
      </span>
      Stop
    </button>
  );
}
