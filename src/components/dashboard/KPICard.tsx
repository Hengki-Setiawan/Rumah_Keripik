'use client';

interface KPICardProps {
  title: string;
  value: number;
  change?: number;
  icon: string;
  prefix?: string;
  suffix?: string;
  urgent?: boolean;
}

export function KPICard({
  title, value, change, icon, prefix = '', suffix = '', urgent = false,
}: KPICardProps) {
  const isPositive = (change || 0) >= 0;

  return (
    <div className={`bg-surface-container-lowest border rounded-xl p-4 shadow-sm ${urgent ? 'border-orange-400' : 'border-neutral-200'}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-2xl">{icon}</span>
        {change !== undefined && (
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
            isPositive
              ? 'bg-green-100 text-green-700'
              : 'bg-red-100 text-red-700'
          }`}>
            {isPositive ? '▲' : '▼'} {Math.abs(change).toFixed(1)}%
          </span>
        )}
        {urgent && change === undefined && (
          <span className="w-2 h-2 rounded-full bg-orange-400 animate-pulse" />
        )}
      </div>
      <p className="text-2xl font-bold">
        {prefix}{typeof value === 'number' && value > 1000
          ? value.toLocaleString('id-ID')
          : value}{suffix}
      </p>
      <p className="text-sm text-on-surface-variant mt-0.5">{title}</p>
    </div>
  );
}
