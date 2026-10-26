import { Skeleton, SkeletonCard, SkeletonTable } from "@/components/ui/skeleton";

export default function RequestsLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Skeleton className="h-3 w-36 rounded" />
        <Skeleton className="h-8 w-64 rounded" />
        <Skeleton className="h-4 w-full max-w-2xl rounded" />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {[0, 1, 2].map((index) => (
          <SkeletonCard key={index} />
        ))}
      </div>
      <div className="space-y-4">
        {[0, 1].map((index) => (
          <SkeletonTable key={index} rows={4} columns={4} />
        ))}
      </div>
    </div>
  );
}
