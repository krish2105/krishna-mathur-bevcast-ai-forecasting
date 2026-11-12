import { Skeleton } from "@/components/ui/skeleton";

/** Route-level loading state in the shape of a typical page: header, KPI row, chart, table. */
export function PageSkeleton({ kpis = 4, charts = 1 }: { kpis?: number; charts?: number }) {
  return (
    <div className="space-y-8" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading…</span>
      <div className="space-y-3">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-8 w-2/3 max-w-xl" />
        <Skeleton className="h-4 w-full max-w-2xl" />
      </div>
      {kpis > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: kpis }, (_, i) => (
            <div key={i} className="card-surface space-y-3 p-5">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-8 w-28" />
              <Skeleton className="h-4 w-36" />
            </div>
          ))}
        </div>
      )}
      {Array.from({ length: charts }, (_, i) => (
        <div key={i} className="card-surface space-y-4 p-5">
          <Skeleton className="h-4 w-64" />
          <Skeleton className="h-[280px] w-full" />
        </div>
      ))}
    </div>
  );
}
