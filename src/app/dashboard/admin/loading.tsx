import { SkeletonCard, SkeletonRow } from "@/components/ui/skeleton";

export default function AdminConsoleLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div className="shimmer h-3 w-32 rounded bg-muted" />
        <div className="shimmer h-8 w-72 rounded bg-muted" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <SkeletonCard key={index} className="h-28" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <SkeletonCard className="h-64" />
        <SkeletonCard className="h-64" />
      </div>
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <SkeletonRow key={index} />
        ))}
      </div>
    </div>
  );
}
