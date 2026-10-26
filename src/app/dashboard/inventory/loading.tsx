import { Skeleton, SkeletonTable } from "@/components/ui/skeleton";

export default function InventoryLoading() {
  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <div className="h-3 w-32 rounded bg-cream-dark/70" />
        <div className="h-8 w-64 rounded bg-cream-dark/70" />
        <Skeleton className="h-4 w-96" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-28 rounded-xl" variant="shimmer" />
        ))}
      </div>

      <SkeletonTable rows={10} columns={6} />
    </div>
  );
}
