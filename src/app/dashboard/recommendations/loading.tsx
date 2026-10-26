import { Skeleton } from "@/components/ui/skeleton";

function GridSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 3 }).map((_, index) => (
        <Skeleton key={index} className="h-52 w-full rounded-xl" />
      ))}
    </div>
  );
}

export default function RecommendationsLoading() {
  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <Skeleton className="h-3 w-28 rounded" />
        <Skeleton className="h-8 w-56 rounded" />
        <Skeleton className="h-4 w-full max-w-2xl rounded" />
      </div>
      <div className="space-y-4">
        <Skeleton className="h-6 w-64 rounded" />
        <GridSkeleton />
      </div>
      <div className="space-y-4">
        <Skeleton className="h-6 w-56 rounded" />
        <GridSkeleton />
      </div>
    </div>
  );
}
