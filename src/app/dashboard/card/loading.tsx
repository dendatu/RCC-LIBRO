import { Skeleton, SkeletonCard } from "@/components/ui/skeleton";

export default function CardLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Skeleton className="h-3 w-28 rounded" />
        <Skeleton className="h-8 w-52 rounded" />
        <Skeleton className="h-4 w-full max-w-2xl rounded" />
      </div>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,24rem)_1fr]">
        <Skeleton className="aspect-[8/5] w-full rounded-2xl" />
        <div className="space-y-4">
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </div>
    </div>
  );
}
