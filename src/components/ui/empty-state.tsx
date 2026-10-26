import * as React from "react";

import { cn } from "@/lib/utils";

function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      data-slot="empty-state"
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-brand-200 bg-parchment px-6 py-12 text-center",
        className
      )}
    >
      {icon ? (
        <div className="flex size-12 items-center justify-center rounded-full bg-brand-100 text-brand-600 [&_svg]:size-6">
          {icon}
        </div>
      ) : null}
      <div className="flex flex-col gap-1.5">
        <p className="font-serif text-base font-semibold tracking-tight text-foreground">
          {title}
        </p>
        {description ? (
          <p className="mx-auto max-w-md text-sm text-muted-foreground text-balance">
            {description}
          </p>
        ) : null}
      </div>
      {action ? (
        <div className="mt-1 flex flex-wrap items-center justify-center gap-2">
          {action}
        </div>
      ) : null}
    </div>
  );
}

export { EmptyState };
