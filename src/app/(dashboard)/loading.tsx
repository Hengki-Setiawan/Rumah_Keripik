import { Skeleton } from '@/components/ui/skeleton';
import { KpiCardSkeleton } from '@/components/ui/skeleton';

export default function DashboardLoading() {
  return (
    <div className="min-h-screen bg-surface-cream p-container-padding space-y-gutter">
      <div className="flex items-center justify-between mb-8">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-72" />
        </div>
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 !rounded-full" />
          <Skeleton className="h-10 w-24 !rounded-lg" />
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-gutter">
        {[1,2,3,4].map((i) => <KpiCardSkeleton key={i} />)}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-gutter">
        <div className="lg:col-span-8 bg-surface-container-lowest p-6 rounded-xl border border-outline-variant">
          <Skeleton className="h-64 !rounded-lg" />
        </div>
        <div className="lg:col-span-4 space-y-3">
          <Skeleton className="h-40 !rounded-xl" />
          <Skeleton className="h-40 !rounded-xl" />
        </div>
      </div>
    </div>
  );
}
