import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Search params arrive as `string | string[]`; every admin filter is single-valued. */
export function singleParam(value: string | string[] | undefined): string {
  const raw = Array.isArray(value) ? value[0] : value;
  return (raw ?? "").trim();
}

/** Number param with a hard floor and ceiling, so a hand-edited URL cannot ask for page 0. */
export function intParam(value: string | string[] | undefined, fallback: number, min = 1, max = 10_000) {
  const parsed = Number(singleParam(value));
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.round(parsed)));
}

/** Merge the active filter set with per-link overrides and drop empty keys. */
export function buildQuery(
  base: Record<string, string>,
  overrides: Record<string, string | undefined>,
): string {
  const merged: Record<string, string> = { ...base };
  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) delete merged[key];
    else merged[key] = value;
  }
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(merged)) {
    if (value) params.set(key, value);
  }
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

/**
 * GET-driven filter control. The admin list pages filter with a plain form so the
 * result is a shareable URL and the tables stay Server Components.
 */
export function FilterSelect({
  label,
  name,
  value,
  options,
  className,
}: {
  label: string;
  name: string;
  value: string;
  options: { value: string; label: string }[];
  className?: string;
}) {
  const id = `filter-${name}`;
  return (
    <div className={cn("flex min-w-0 flex-col gap-1", className)}>
      <label htmlFor={id} className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </label>
      <select
        id={id}
        name={name}
        defaultValue={value}
        className="h-9 rounded-lg border border-input bg-card px-3 text-sm text-foreground shadow-xs outline-none transition-[color,box-shadow,border-color] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/25"
      >
        {options.map((option) => (
          <option key={option.value || "any"} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

/** Prev/next pager with a page counter; renders nothing while the list fits one page. */
export function PaginationNav({
  basePath,
  query,
  page,
  pageCount,
  total,
  perPage,
}: {
  basePath: string;
  query: Record<string, string>;
  page: number;
  pageCount: number;
  total: number;
  perPage: number;
}) {
  if (pageCount <= 1) {
    return (
      <p className="text-xs text-muted-foreground">
        Showing all {total.toLocaleString("en-PH")} record(s).
      </p>
    );
  }

  const from = (page - 1) * perPage + 1;
  const to = Math.min(page * perPage, total);

  return (
    <nav aria-label="Pagination" className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-xs text-muted-foreground">
        {from.toLocaleString("en-PH")}–{to.toLocaleString("en-PH")} of {total.toLocaleString("en-PH")}
      </p>
      <div className="flex items-center gap-2">
        {page > 1 ? (
          <Button asChild size="sm" variant="outline">
            <Link href={`${basePath}${buildQuery(query, { page: String(page - 1) })}`}>
              <ChevronLeft /> Previous
            </Link>
          </Button>
        ) : null}
        <span className="text-xs tabular-nums text-muted-foreground">
          Page {page} of {pageCount}
        </span>
        {page < pageCount ? (
          <Button asChild size="sm" variant="outline">
            <Link href={`${basePath}${buildQuery(query, { page: String(page + 1) })}`}>
              Next <ChevronRight />
            </Link>
          </Button>
        ) : null}
      </div>
    </nav>
  );
}

/** Compact status chip that maps a raw Postgres status onto the brand tone table. */
export function StatusTag({
  status,
  tone,
  label,
}: {
  status: string;
  tone: string;
  label?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold tracking-wide",
        tone,
      )}
      data-status={status}
    >
      {label ?? status}
    </span>
  );
}
