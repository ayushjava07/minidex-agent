export default function Skeleton({ className = "", width, height = "1rem", rounded = true }) {
  return (
    <div
      className={`animate-pulse bg-slate-200 dark:bg-surface-border ${rounded ? "rounded-lg" : ""} ${className}`}
      style={{ width, height }}
    />
  );
}

export function StatSkeleton() {
  return (
    <div className="glass p-5 space-y-3">
      <Skeleton width="60%" height="0.75rem" />
      <Skeleton width="80%" height="1.75rem" />
      <Skeleton width="40%" height="0.75rem" />
    </div>
  );
}

export function TableSkeleton({ rows = 5 }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4">
          <Skeleton className="flex-1" height="1rem" />
          <Skeleton width="80px" height="1rem" />
          <Skeleton width="60px" height="1rem" />
          <Skeleton width="100px" height="1rem" />
          <Skeleton width="70px" height="1.5rem" rounded />
        </div>
      ))}
    </div>
  );
}

export function ChartSkeleton() {
  return (
    <div className="glass p-5 space-y-4">
      <Skeleton width="40%" height="1.25rem" />
      <div className="flex items-end gap-2 h-48">
        {Array.from({ length: 12 }).map((_, i) => (
          <Skeleton key={i} className="flex-1" height={`${30 + Math.random() * 70}%`} rounded />
        ))}
      </div>
    </div>
  );
}
