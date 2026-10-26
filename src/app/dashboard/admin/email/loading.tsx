import { SkeletonCard, SkeletonTable } from "@/components/ui/skeleton";

export default function AdminEmailLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div className="shimmer h-3 w-36 rounded bg-muted" />
        <div className="shimmer h-8 w-56 rounded bg-muted" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <SkeletonCard key={index} className="h-24" />
        ))}
      </div>
      <SkeletonTable rows={8} columns={6} />
    </div>
  );
}
