import { Skeleton } from "@/components/ui/skeleton";

export default function QrStudioLoading() {
  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <div className="h-3 w-32 rounded bg-cream-dark/70" />
        <div className="h-8 w-56 rounded bg-cream-dark/70" />
        <Skeleton className="h-4 w-full max-w-2xl" />
      </div>

      <div className="surface-card p-4">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="space-y-1.5">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-9 rounded-lg" variant="shimmer" />
            </div>
          ))}
        </div>
      </div>

      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <Skeleton className="h-8 w-40 rounded-lg" />
        <Skeleton className="h-8 w-56 rounded-lg" />
      </div>

      <div className="paper-texture rounded-xl border border-border p-5">
        <div className="flex flex-wrap gap-3">
          {Array.from({ length: 8 }).map((_, index) => (
            <Skeleton key={index} className="h-40 w-[212px] rounded-lg" variant="shimmer" />
          ))}
        </div>
      </div>
    </div>
  );
}
