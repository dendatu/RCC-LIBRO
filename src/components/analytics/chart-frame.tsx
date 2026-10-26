"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** RCC LIBRO brand palette used across every chart on the analytics dashboard. */
export const CHART_COLORS = {
  brand: "#6F4E37",
  gold: "#D4A373",
  caramel: "#A97D55",
  ink: "#2D2D2D",
  success: "#3F7D5A",
  amber: "#C8892A",
  grid: "#E8DFCD",
  axis: "#7A726A",
} as const;

export const CHART_SERIES = [
  CHART_COLORS.brand,
  CHART_COLORS.gold,
  CHART_COLORS.caramel,
  CHART_COLORS.success,
  CHART_COLORS.amber,
  CHART_COLORS.ink,
] as const;

export function seriesColor(index: number) {
  return CHART_SERIES[index % CHART_SERIES.length];
}

export function ChartCard({
  title,
  description,
  action,
  footer,
  className,
  delay = 0,
  children,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  footer?: ReactNode;
  className?: string;
  delay?: number;
  children: ReactNode;
}) {
  const reduceMotion = useReducedMotion();
  return (
    <motion.section
      initial={{ opacity: 0, y: reduceMotion ? 0 : 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduceMotion ? 0.2 : 0.45, delay, ease: "easeOut" }}
      className={cn(
        "flex flex-col gap-4 rounded-xl border border-border bg-card p-5 shadow-[var(--shadow-card)]",
        className,
      )}
      aria-label={title}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-serif text-base leading-none font-semibold tracking-tight text-ink">
            {title}
          </h2>
          {description ? (
            <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
      </div>
      <div className="min-w-0">{children}</div>
      {footer ? (
        <div className="border-t border-border pt-3 text-xs leading-relaxed text-muted-foreground">
          {footer}
        </div>
      ) : null}
    </motion.section>
  );
}

interface TooltipEntry {
  name?: string | number;
  value?: string | number;
  color?: string;
  dataKey?: string | number;
  payload?: Record<string, unknown>;
}

/**
 * Theme-styled tooltip. Recharts clones this element with its own runtime props,
 * so every prop is optional and the payload is read defensively.
 */
export function ChartTooltip({
  active,
  payload,
  label,
  format,
}: {
  active?: boolean;
  payload?: readonly TooltipEntry[];
  label?: string | number;
  format?: (value: number, entry: TooltipEntry) => string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 text-xs shadow-[var(--shadow-lift)]">
      {label !== undefined && label !== "" ? (
        <p className="mb-1.5 font-serif text-sm font-semibold text-ink">{String(label)}</p>
      ) : null}
      <ul className="flex min-w-40 flex-col gap-1">
        {payload.map((entry, index) => {
          const numeric = typeof entry.value === "number" ? entry.value : Number(entry.value);
          const rendered =
            Number.isFinite(numeric) && typeof entry.value === "number"
              ? (format?.(numeric, entry) ?? numeric.toLocaleString("en-PH"))
              : String(entry.value ?? "—");
          return (
            <li key={`${String(entry.dataKey)}-${index}`} className="flex items-center gap-2">
              <span
                aria-hidden
                className="size-2 shrink-0 rounded-full"
                style={{ background: entry.color ?? CHART_COLORS.brand }}
              />
              <span className="truncate text-muted-foreground">{entry.name}</span>
              <span className="ml-auto font-semibold tabular-nums text-ink">{rendered}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Visually hidden mirror of the plotted data so screen readers get the numbers. */
export function ChartDataSource({
  caption,
  headers,
  rows,
}: {
  caption: string;
  headers: string[];
  rows: (string | number)[][];
}) {
  return (
    <table className="sr-only">
      <caption>{caption}</caption>
      <thead>
        <tr>
          {headers.map((header) => (
            <th key={header} scope="col">
              {header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, index) => (
          <tr key={index}>
            {row.map((cell, cellIndex) => (
              <td key={cellIndex}>{String(cell)}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function ChartEmpty({ message }: { message: string }) {
  return (
    <div className="flex h-40 flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-brand-200 bg-parchment px-4 text-center">
      <p className="text-sm font-medium text-ink">Nothing to plot yet</p>
      <p className="max-w-xs text-xs text-muted-foreground">{message}</p>
    </div>
  );
}

export const AXIS_TICK = {
  fill: CHART_COLORS.axis,
  fontSize: 11,
} as const;
