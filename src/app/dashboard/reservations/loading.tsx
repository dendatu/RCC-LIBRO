import { Skeleton, SkeletonCard, SkeletonTable } from "@/components/ui/skeleton";

export default function ReservationsLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Skeleton className="h-3 w-28 rounded" />
        <Skeleton className="h-8 w-56 rounded" />
        <Skeleton className="h-4 w-full max-w-2xl rounded" />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {[0, 1, 2].map((index) => (
          <SkeletonCard key={index} />
        ))}
      </div>
      <div className="grid gap-4">
        {[0, 1, 2].map((index) => (
          <SkeletonCard key={index} />
        ))}
      </div>
      <SkeletonTable rows={3} columns={3} />
    </div>
  );
}
