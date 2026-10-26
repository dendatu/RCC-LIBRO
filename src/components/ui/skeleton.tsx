import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const skeletonVariants = cva("rounded-lg bg-cream-dark/70", {
  variants: {
    variant: {
      pulse: "animate-pulse",
      shimmer: "shimmer",
    },
  },
  defaultVariants: {
    variant: "pulse",
  },
});

function Skeleton({
  className,
  variant,
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof skeletonVariants>) {
  return (
    <div
      data-slot="skeleton"
      aria-hidden="true"
      className={cn(skeletonVariants({ variant }), className)}
      {...props}
    />
  );
}

function SkeletonRow({
  count = 1,
  className,
  rowClassName,
  variant,
}: {
  count?: number;
  className?: string;
  rowClassName?: string;
  variant?: VariantProps<typeof skeletonVariants>["variant"];
}) {
  return (
    <div
      data-slot="skeleton-row"
      className={cn("flex w-full items-center gap-3", className)}
    >
      {Array.from({ length: Math.max(0, count) }).map((_, index) => (
        <Skeleton
          key={index}
          variant={variant}
          className={cn("h-4 flex-1", rowClassName)}
        />
      ))}
    </div>
  );
}

function SkeletonCard({
  className,
  variant,
}: {
  className?: string;
  variant?: VariantProps<typeof skeletonVariants>["variant"];
}) {
  return (
    <div
      data-slot="skeleton-card"
      className={cn(
        "flex flex-col gap-4 rounded-xl border border-border bg-card p-6 shadow-[var(--shadow-card)]",
        className
      )}
    >
      <div className="flex items-center gap-3">
        <Skeleton variant={variant} className="size-10 rounded-full" />
        <Skeleton variant={variant} className="h-4 w-1/3" />
      </div>
      <Skeleton variant={variant} className="h-3 w-2/3" />
      <Skeleton variant={variant} className="h-3 w-full" />
      <Skeleton variant={variant} className="h-3 w-4/5" />
      <div className="flex gap-2">
        <Skeleton variant={variant} className="h-8 w-24 rounded-lg" />
        <Skeleton variant={variant} className="h-8 w-20 rounded-lg" />
      </div>
    </div>
  );
}

function SkeletonTable({
  rows = 5,
  columns = 4,
  className,
  variant,
}: {
  rows?: number;
  columns?: number;
  className?: string;
  variant?: VariantProps<typeof skeletonVariants>["variant"];
}) {
  const safeRows = Math.max(1, rows);
  const safeColumns = Math.max(1, columns);
  const template = `repeat(${safeColumns}, minmax(0, 1fr))`;

  return (
    <div
      data-slot="skeleton-table"
      className={cn(
        "w-full overflow-hidden rounded-xl border border-border bg-card shadow-[var(--shadow-card)]",
        className
      )}
    >
      <div
        className="grid gap-4 border-b border-border bg-secondary px-4 py-3"
        style={{ gridTemplateColumns: template }}
      >
        {Array.from({ length: safeColumns }).map((_, index) => (
          <Skeleton key={`head-${index}`} variant={variant} className="h-3 w-3/4" />
        ))}
      </div>
      <div className="divide-y divide-border">
        {Array.from({ length: safeRows }).map((_, rowIndex) => (
          <div
            key={`row-${rowIndex}`}
            className="grid gap-4 px-4 py-3.5"
            style={{ gridTemplateColumns: template }}
          >
            {Array.from({ length: safeColumns }).map((_, columnIndex) => (
              <Skeleton
                key={`cell-${rowIndex}-${columnIndex}`}
                variant={variant}
                className={cn("h-3", columnIndex === 0 ? "w-4/5" : "w-3/5")}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export { Skeleton, SkeletonCard, SkeletonRow, SkeletonTable, skeletonVariants };
