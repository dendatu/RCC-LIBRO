import { Skeleton } from "@/components/ui/skeleton";

export default function NewAccessionLoading() {
  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <div className="h-3 w-40 rounded bg-cream-dark/70" />
        <div className="h-8 w-72 rounded bg-cream-dark/70" />
        <Skeleton className="h-4 w-full max-w-2xl" />
      </div>

      {Array.from({ length: 3 }).map((_, group) => (
        <div key={group} className="rounded-xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
          <div className="space-y-2">
            <Skeleton className="h-4 w-44" />
            <Skeleton className="h-3 w-72" />
          </div>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            {Array.from({ length: group === 0 ? 6 : 4 }).map((_, field) => (
              <div key={field} className="space-y-2">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-9 rounded-lg" variant="shimmer" />
              </div>
            ))}
          </div>
        </div>
      ))}

      <div className="flex gap-2">
        <Skeleton className="h-9 w-32 rounded-lg" />
        <Skeleton className="h-9 w-40 rounded-lg" />
      </div>
    </div>
  );
}
