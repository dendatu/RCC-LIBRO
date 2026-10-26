import { Skeleton, SkeletonCard, SkeletonTable } from "@/components/ui/skeleton";

/** Shared loading state for the administration screens. */
export function AdminSkeleton({
  label,
  tiles = 0,
  tables = 1,
  columns = 5,
  rows = 8,
}: {
  label: string;
  tiles?: number;
  tables?: number;
  columns?: number;
  rows?: number;
}) {
  return (
    <div className="space-y-8" aria-busy="true" aria-label={label}>
      <div className="space-y-3">
        <Skeleton className="h-3 w-36" />
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-4 w-full max-w-2xl" />
      </div>

      {tiles > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: tiles }).map((_, index) => (
            <SkeletonCard key={index} />
          ))}
        </div>
      ) : null}

      <Skeleton className="h-16 w-full rounded-xl" />

      {Array.from({ length: tables }).map((_, index) => (
        <SkeletonTable key={index} rows={rows} columns={columns} />
      ))}
    </div>
  );
}
