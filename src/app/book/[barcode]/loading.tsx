import { SkeletonCard, SkeletonRow } from "@/components/ui/skeleton";

export default function BookLookupLoading() {
  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-10">
      <div className="grid gap-6 sm:grid-cols-[12rem_1fr]">
        <SkeletonCard className="h-56" />
        <div className="space-y-3">
          <div className="shimmer h-3 w-24 rounded bg-muted" />
          <div className="shimmer h-8 w-3/4 rounded bg-muted" />
          <div className="shimmer h-4 w-1/2 rounded bg-muted" />
          <div className="shimmer h-24 w-full rounded bg-muted" />
        </div>
      </div>
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, index) => (
          <SkeletonRow key={index} />
        ))}
      </div>
    </div>
  );
}
