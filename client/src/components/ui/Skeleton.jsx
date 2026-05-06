import { cn } from '../../utils/cn';

export const Skeleton = ({ className }) => (
  <div
    className={cn(
      'bg-neutral-200 dark:bg-neutral-700 rounded animate-pulse',
      className
    )}
  />
);

export const StatSkeleton = () => (
  <div className="card p-5 space-y-3">
    <div className="flex items-center justify-between">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="h-8 w-8 rounded-lg" />
    </div>
    <Skeleton className="h-7 w-32" />
    <Skeleton className="h-3 w-20" />
  </div>
);

export const ChartSkeleton = () => (
  <div className="card p-5 space-y-3">
    <Skeleton className="h-4 w-32" />
    <Skeleton className="h-3 w-48" />
    <div className="h-44 flex items-end gap-2 pt-4">
      {[60, 80, 45, 90, 70, 55, 85, 65, 75, 50, 88, 72].map((h, i) => (
        <Skeleton
          key={i}
          className="flex-1 rounded-sm"
          style={{ height: `${h}%` }}
        />
      ))}
    </div>
  </div>
);

export const TableRowSkeleton = ({ rows = 5 }) => (
  <div className="space-y-0">
    {Array.from({ length: rows }).map((_, i) => (
      <div
        key={i}
        className="flex items-center gap-4 px-4 py-3.5 border-b border-[var(--border)] last:border-0"
      >
        <Skeleton className="w-8 h-8 rounded-lg flex-shrink-0" />
        <div className="flex-1 space-y-1.5">
          <Skeleton className="h-3 w-40" />
          <Skeleton className="h-2.5 w-24" />
        </div>
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>
    ))}
  </div>
);

export const CardSkeleton = () => (
  <div className="card p-5 space-y-3">
    <Skeleton className="h-4 w-28" />
    <Skeleton className="h-3 w-40" />
    <div className="space-y-2 pt-1">
      {[1, 2, 3].map(i => (
        <Skeleton key={i} className="h-8 w-full rounded-lg" />
      ))}
    </div>
  </div>
);