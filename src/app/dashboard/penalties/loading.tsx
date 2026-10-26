import { SkeletonCard, SkeletonTable } from "@/components/ui/skeleton";

export default function PenaltiesLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div className="shimmer h-3 w-32 rounded bg-muted" />
        <div className="shimmer h-8 w-64 rounded bg-muted" />
        <div className="shimmer h-4 w-96 rounded bg-muted" />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {[0, 1, 2].map((index) => (
          <SkeletonCard key={index} />
        ))}
      </div>
      <SkeletonTable rows={6} columns={4} />
    </div>
  );
}
