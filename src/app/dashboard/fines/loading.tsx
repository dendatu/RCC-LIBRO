import { SkeletonCard, SkeletonTable } from "@/components/ui/skeleton";

export default function FinesLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div className="shimmer h-3 w-40 rounded bg-muted" />
        <div className="shimmer h-8 w-56 rounded bg-muted" />
        <div className="shimmer h-4 w-96 rounded bg-muted" />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[0, 1, 2, 3].map((index) => (
          <SkeletonCard key={index} />
        ))}
      </div>
      <SkeletonTable rows={8} columns={6} />
    </div>
  );
}
