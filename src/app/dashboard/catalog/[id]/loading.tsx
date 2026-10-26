import { Skeleton, SkeletonTable } from "@/components/ui/skeleton";

export default function CatalogRecordLoading() {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-2">
          <div className="h-3 w-32 rounded bg-cream-dark/70" />
          <div className="h-8 w-80 rounded bg-cream-dark/70" />
          <Skeleton className="h-4 w-56" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-9 w-28 rounded-lg" />
          <Skeleton className="h-9 w-28 rounded-lg" />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-6 shadow-[var(--shadow-card)] lg:col-span-2">
          <div className="flex flex-col gap-5 sm:flex-row">
            <Skeleton className="aspect-[2/3] w-36 shrink-0 rounded-md" variant="shimmer" />
            <div className="min-w-0 flex-1 space-y-3">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-3 w-full" />
              {Array.from({ length: 6 }).map((_, index) => (
                <Skeleton key={index} className="h-6 w-full" />
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          {Array.from({ length: 2 }).map((_, index) => (
            <div key={index} className="rounded-xl border border-border bg-card p-5 shadow-[var(--shadow-card)]">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="mt-3 h-2 w-full rounded-full" />
              <div className="mt-4 space-y-2">
                {Array.from({ length: 4 }).map((_, row) => (
                  <Skeleton key={row} className="h-3 w-4/5" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="mt-2 h-3 w-96" />
        <SkeletonTable rows={4} columns={6} className="mt-4" />
      </div>

      <SkeletonTable rows={5} columns={5} />
    </div>
  );
}
