import { SkeletonCard } from "@/components/ui/skeleton";

export default function AdminSettingsLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div className="shimmer h-3 w-40 rounded bg-muted" />
        <div className="shimmer h-8 w-72 rounded bg-muted" />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <SkeletonCard key={index} className="h-72" />
        ))}
      </div>
    </div>
  );
}
