import { Skeleton, SkeletonCard } from "@/components/ui/skeleton";

export default function CirculationLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div className="shimmer h-3 w-40 rounded bg-muted" />
        <div className="shimmer h-8 w-56 rounded bg-muted" />
        <div className="shimmer h-4 w-96 rounded bg-muted" />
      </div>
      <div className="shimmer h-16 w-full rounded-xl bg-muted" />
      <div className="grid gap-6 lg:grid-cols-5">
        <div className="surface-card space-y-5 p-6 lg:col-span-3">
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-10 w-full" />
          <div className="grid gap-4 sm:grid-cols-[8rem_1fr]">
            <Skeleton className="h-9" />
            <Skeleton className="h-20" />
          </div>
          <Skeleton className="h-11 w-full" />
        </div>
        <div className="space-y-5 lg:col-span-2">
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </div>
    </div>
  );
}
