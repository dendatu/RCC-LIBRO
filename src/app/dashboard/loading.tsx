import { SkeletonCard, SkeletonTable } from "@/components/ui/skeleton";

export default function DashboardLoading() {
  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <div className="shimmer h-3 w-40 rounded bg-muted" />
        <div className="shimmer h-8 w-72 rounded bg-muted" />
        <div className="shimmer h-4 w-96 rounded bg-muted" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((index) => (
          <SkeletonCard key={index} />
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <SkeletonTable rows={5} columns={4} />
        </div>
        <SkeletonCard />
      </div>
    </div>
  );
}
