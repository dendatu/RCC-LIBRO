import { Skeleton, SkeletonCard } from "@/components/ui/skeleton";

export default function NewArrivalsLoading() {
  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <div className="h-3 w-28 rounded bg-cream-dark/70" />
        <div className="h-8 w-64 rounded bg-cream-dark/70" />
        <Skeleton className="h-4 w-full max-w-2xl" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-28 rounded-xl" variant="shimmer" />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <SkeletonCard key={index} variant="shimmer" />
        ))}
      </div>
    </div>
  );
}
