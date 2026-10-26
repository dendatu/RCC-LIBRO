import { Skeleton, SkeletonTable } from "@/components/ui/skeleton";

export default function ReportsLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Skeleton className="h-3 w-44 rounded" />
        <Skeleton className="h-8 w-44 rounded" />
        <Skeleton className="h-4 w-full max-w-2xl rounded" />
      </div>
      <div className="flex gap-2">
        {[0, 1, 2, 3].map((index) => (
          <Skeleton key={index} className="h-9 w-28 rounded-lg" />
        ))}
      </div>
      <Skeleton className="h-10 w-64 rounded" />
      <SkeletonTable rows={8} columns={6} />
    </div>
  );
}
