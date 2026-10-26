import { SkeletonCard } from "@/components/ui/skeleton";

export default function BorrowingsLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div className="shimmer h-3 w-32 rounded bg-muted" />
        <div className="shimmer h-8 w-56 rounded bg-muted" />
        <div className="shimmer h-4 w-80 rounded bg-muted" />
      </div>
      <div className="space-y-4">
        {[0, 1, 2].map((index) => (
          <SkeletonCard key={index} />
        ))}
      </div>
    </div>
  );
}
