import { SkeletonCard } from "@/components/ui/skeleton";

export default function MemberCardLoading() {
  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-10">
      <div className="space-y-3">
        <div className="shimmer h-3 w-28 rounded bg-muted" />
        <div className="shimmer h-8 w-56 rounded bg-muted" />
      </div>
      <SkeletonCard className="h-64" />
      <div className="grid gap-4 sm:grid-cols-2">
        <SkeletonCard className="h-40" />
        <SkeletonCard className="h-40" />
      </div>
    </div>
  );
}
