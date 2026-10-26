import { SkeletonCard } from "@/components/ui/skeleton";

export default function AdminBranchesLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div className="shimmer h-3 w-44 rounded bg-muted" />
        <div className="shimmer h-8 w-80 rounded bg-muted" />
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <SkeletonCard key={index} className="h-44" />
        ))}
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <SkeletonCard key={index} className="h-24" />
        ))}
      </div>
    </div>
  );
}
