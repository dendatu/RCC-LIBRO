import { Skeleton, SkeletonCard } from "@/components/ui/skeleton";

export default function ProfileLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Skeleton className="h-3 w-28 rounded" />
        <Skeleton className="h-8 w-52 rounded" />
        <Skeleton className="h-4 w-full max-w-2xl rounded" />
      </div>
      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <SkeletonCard className="min-h-[28rem]" />
        <div className="space-y-4">
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </div>
    </div>
  );
}
