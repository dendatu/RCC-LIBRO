import { SkeletonCard, SkeletonTable } from "@/components/ui/skeleton";

export default function MembersLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div className="shimmer h-3 w-40 rounded bg-muted" />
        <div className="shimmer h-8 w-64 rounded bg-muted" />
        <div className="shimmer h-4 w-96 rounded bg-muted" />
      </div>
      <SkeletonCard className="h-16" />
      <SkeletonTable rows={10} columns={7} />
    </div>
  );
}
