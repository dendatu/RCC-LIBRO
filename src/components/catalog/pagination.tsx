import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Pagination for a filtered list — hrefs are precomputed by the caller. */
export function Pagination({
  page,
  perPage,
  total,
  hrefFor,
  className,
}: {
  page: number;
  perPage: number;
  total: number;
  hrefFor: (page: number) => string;
  className?: string;
}) {
  const pages = Math.max(1, Math.ceil(total / perPage));
  if (total === 0) return null;

  const from = (page - 1) * perPage + 1;
  const to = Math.min(total, page * perPage);
  const windowStart = Math.max(1, Math.min(page - 2, pages - 4));
  const numbers = Array.from({ length: Math.min(5, pages) }, (_, index) => windowStart + index);

  return (
    <nav
      className={cn("flex flex-wrap items-center justify-between gap-3", className)}
      aria-label="Catalogue pages"
    >
      <p className="text-xs text-muted-foreground">
        Showing <span className="font-medium text-ink">{from}–{to}</span> of{" "}
        <span className="font-medium text-ink">{total}</span> title{total === 1 ? "" : "s"}
      </p>

      <div className="flex items-center gap-1">
        {page > 1 ? (
          <Button variant="outline" size="sm" asChild>
            <Link href={hrefFor(page - 1)} rel="prev">
              <ChevronLeft className="size-3.5" /> Previous
            </Link>
          </Button>
        ) : null}

        <div className="hidden items-center gap-1 sm:flex">
          {numbers.map((number) => (
            <Link
              key={number}
              href={hrefFor(number)}
              aria-current={number === page ? "page" : undefined}
              className={cn(
                "size-8 rounded-lg text-xs font-medium tabular-nums transition-colors",
                number === page
                  ? "bg-brand-600 text-cream"
                  : "text-ink-soft hover:bg-muted hover:text-ink",
              )}
            >
              {number}
            </Link>
          ))}
        </div>

        {page < pages ? (
          <Button variant="outline" size="sm" asChild>
            <Link href={hrefFor(page + 1)} rel="next">
              Next <ChevronRight className="size-3.5" />
            </Link>
          </Button>
        ) : null}
      </div>
    </nav>
  );
}
