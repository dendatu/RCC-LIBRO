import * as React from "react";

import { cn } from "@/lib/utils";

function SectionHeader({
  title,
  description,
  action,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      data-slot="section-header"
      className={cn(
        "flex flex-wrap items-end justify-between gap-x-6 gap-y-3",
        className
      )}
    >
      <div className="flex min-w-0 flex-col gap-1">
        <h2 className="font-serif text-xl leading-tight font-semibold tracking-tight text-foreground text-balance sm:text-2xl">
          {title}
        </h2>
        {description ? (
          <p className="max-w-2xl text-sm text-muted-foreground text-balance">
            {description}
          </p>
        ) : null}
      </div>
      {action ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2">{action}</div>
      ) : null}
    </div>
  );
}

export { SectionHeader };
