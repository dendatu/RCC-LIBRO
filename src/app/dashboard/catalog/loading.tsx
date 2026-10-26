import { SkeletonCard } from "@/components/ui/skeleton";

export default function CatalogLoading() {
  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <div className="h-3 w-28 rounded bg-cream-dark/70" />
        <div className="h-8 w-52 rounded bg-cream-dark/70" />
      </div>

      <div className="surface-card p-4">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-9 rounded-lg bg-cream-dark/70" />
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <SkeletonCard key={index} variant="shimmer" />
        ))}
      </div>
    </div>
  );
}
