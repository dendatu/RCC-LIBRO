import { SkeletonCard, SkeletonTable } from "@/components/ui/skeleton";

export default function AdminLogsLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div className="shimmer h-3 w-28 rounded bg-muted" />
        <div className="shimmer h-8 w-48 rounded bg-muted" />
      </div>
      <SkeletonCard className="h-16" />
      <SkeletonTable rows={12} columns={5} />
    </div>
  );
}
