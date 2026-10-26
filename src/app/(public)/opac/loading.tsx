import { Skeleton } from "@/components/ui/skeleton";

export default function OpacLoading() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-16 pt-10 sm:px-6 lg:px-8">
      <div className="space-y-3">
        <div className="h-3 w-48 rounded bg-brand-100" />
        <div className="h-10 w-3/4 rounded bg-brand-100 sm:h-12" />
        <Skeleton className="h-4 w-full max-w-2xl" />
      </div>

      <div className="surface-card mt-8 space-y-4 p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row">
          <Skeleton className="h-12 flex-1 rounded-xl" variant="shimmer" />
          <Skeleton className="h-12 w-full rounded-xl sm:w-32" variant="shimmer" />
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-20 rounded-xl" variant="shimmer" />
          ))}
        </div>
      </div>

      <Skeleton className="mt-6 h-5 w-72" />

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div
            key={index}
            className="flex gap-4 rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-card)]"
          >
            <Skeleton className="h-32 w-24 rounded-md" variant="shimmer" />
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-4 w-4/5" />
              <Skeleton className="h-3 w-1/2" />
              <Skeleton className="h-3 w-2/3" />
              <Skeleton className="h-8 w-28 rounded-lg" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
