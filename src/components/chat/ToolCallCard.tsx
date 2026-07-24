'use client';

interface ToolCallCardProps {
  toolName: string;
  label: string;
  status: 'running' | 'done' | 'error';
  result?: Record<string, unknown> | string | null;
}

export function ToolCallCard({ toolName, label, status, result }: ToolCallCardProps) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
      <span className={status === 'running' ? 'animate-spin' : ''}>
        {status === 'running' ? '⚙' : status === 'done' ? '✓' : '✗'}
      </span>
      <span>{label}</span>
      {status === 'done' && result && (
        <span className="ml-auto text-xs text-amber-600">
          {typeof result === 'string' ? result : 'OK'}
        </span>
      )}
    </div>
  );
}
