import { Skeleton, SkeletonCard } from "@/components/ui/skeleton";

export default function NotificationsLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Skeleton className="h-3 w-28 rounded" />
        <Skeleton className="h-8 w-56 rounded" />
        <Skeleton className="h-4 w-full max-w-2xl rounded" />
      </div>
      <div className="space-y-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <SkeletonCard key={index} className="flex-row items-center gap-3" />
        ))}
      </div>
    </div>
  );
}
