import { Skeleton, SkeletonCard, SkeletonTable } from "@/components/ui/skeleton";

export default function AnalyticsLoading() {
  return (
    <div className="space-y-8" aria-busy="true" aria-label="Loading library analytics">
      <div className="space-y-3">
        <Skeleton className="h-3 w-40" />
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-4 w-full max-w-2xl" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <SkeletonCard key={index} />
        ))}
      </div>

      <SkeletonCard className="h-96" />

      <div className="grid gap-6 lg:grid-cols-2">
        <SkeletonCard className="h-80" />
        <SkeletonCard className="h-80" />
      </div>

      <SkeletonCard className="h-[26rem]" />
      <SkeletonTable rows={8} columns={5} />
    </div>
  );
}
