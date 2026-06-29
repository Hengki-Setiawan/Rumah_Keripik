interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className = '' }: SkeletonProps) {
  return (
    <div className={`animate-pulse rounded-xl bg-surface-container-high ${className}`} />
  );
}

export function CardSkeleton() {
  return (
    <div className="bg-surface-container-lowest border border-neutral-200 rounded-xl overflow-hidden">
      <Skeleton className="h-48 !rounded-none" />
      <div className="p-stack-md space-y-3">
        <div className="flex justify-between items-start">
          <Skeleton className="h-5 w-32" />
          <div className="text-right space-y-1">
            <Skeleton className="h-5 w-20 ml-auto" />
            <Skeleton className="h-3 w-16 ml-auto" />
          </div>
        </div>
        <Skeleton className="h-3 w-48" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-4 !rounded-full" />
          <Skeleton className="h-4 w-24" />
        </div>
        <div className="grid grid-cols-2 gap-2 pt-2">
          <Skeleton className="h-10 !rounded-lg" />
          <Skeleton className="h-10 !rounded-lg" />
        </div>
      </div>
    </div>
  );
}

export function KpiCardSkeleton() {
  return (
    <div className="bg-surface-container-lowest border border-neutral-200 rounded-xl p-stack-md">
      <div className="flex items-center justify-between mb-3">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-10 w-10 !rounded-full" />
      </div>
      <Skeleton className="h-7 w-28 mb-2" />
      <Skeleton className="h-4 w-36" />
    </div>
  );
}

export function TableRowSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4 items-center">
          <Skeleton className="h-4 w-1/4" />
          <Skeleton className="h-4 w-1/4" />
          <Skeleton className="h-4 w-1/6" />
          <Skeleton className="h-4 w-1/6 ml-auto" />
        </div>
      ))}
    </div>
  );
}

export function ChatListSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 p-3">
          <Skeleton className="h-12 w-12 !rounded-full shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="flex justify-between items-center">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-3 w-12" />
            </div>
            <Skeleton className="h-3 w-48" />
          </div>
        </div>
      ))}
    </div>
  );
}
