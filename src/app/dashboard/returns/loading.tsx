import { SkeletonCard, SkeletonTable } from "@/components/ui/skeleton";

export default function ReturnsLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div className="shimmer h-3 w-40 rounded bg-muted" />
        <div className="shimmer h-8 w-52 rounded bg-muted" />
        <div className="shimmer h-4 w-96 rounded bg-muted" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <SkeletonCard />
        <SkeletonCard />
      </div>
      <div className="shimmer h-10 w-full max-w-md rounded-lg bg-muted" />
      <SkeletonTable rows={7} columns={5} />
    </div>
  );
}
