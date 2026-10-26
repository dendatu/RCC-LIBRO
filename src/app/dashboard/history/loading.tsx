import { SkeletonCard, SkeletonTable } from "@/components/ui/skeleton";

export default function HistoryLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div className="shimmer h-3 w-32 rounded bg-muted" />
        <div className="shimmer h-8 w-64 rounded bg-muted" />
        <div className="shimmer h-4 w-96 rounded bg-muted" />
      </div>
      <SkeletonCard className="h-20" />
      <SkeletonTable rows={8} columns={7} />
    </div>
  );
}
