import { SkeletonCard, SkeletonTable } from "@/components/ui/skeleton";

export default function SbtrLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div className="shimmer h-3 w-32 rounded bg-muted" />
        <div className="shimmer h-8 w-72 rounded bg-muted" />
        <div className="shimmer h-4 w-96 rounded bg-muted" />
      </div>
      <SkeletonCard />
      <SkeletonTable rows={8} columns={6} />
    </div>
  );
}
