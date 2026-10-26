"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useTransition } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { TrendPoint } from "@/lib/types";
import { formatNumber } from "@/lib/utils";
import {
  AXIS_TICK,
  CHART_COLORS,
  ChartDataSource,
  ChartEmpty,
  ChartTooltip,
} from "./chart-frame";

const WINDOWS = [7, 30, 90] as const;

export function TrendsRangeSwitch({ days }: { days: number }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const select = useCallback(
    (window: number) => {
      if (window === days) return;
      const next = new URLSearchParams(searchParams.toString());
      next.set("days", String(window));
      next.delete("page");
      startTransition(() => {
        router.push(`${pathname}?${next.toString()}`);
      });
    },
    [days, pathname, router, searchParams],
  );

  return (
    <div
      role="group"
      aria-label="Trend window"
      className="inline-flex rounded-lg border border-border bg-secondary p-0.5"
      aria-busy={pending}
    >
      {WINDOWS.map((window) => (
        <button
          key={window}
          type="button"
          onClick={() => select(window)}
          aria-pressed={window === days}
          disabled={pending}
          className={
            window === days
              ? "rounded-md bg-card px-2.5 py-1 text-xs font-semibold text-ink shadow-xs"
              : "rounded-md px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground disabled:opacity-60"
          }
        >
          {window}d
        </button>
      ))}
    </div>
  );
}

function shortDate(bucket: string) {
  const date = new Date(bucket);
  if (Number.isNaN(date.getTime())) return bucket;
  return date.toLocaleDateString("en-PH", { month: "short", day: "numeric" });
}

export function TrendsChart({ points, days }: { points: TrendPoint[]; days: number }) {
  const data = points.map((point) => ({
    ...point,
    label: shortDate(point.bucket),
    fullDate: new Date(point.bucket).toLocaleDateString("en-PH", { dateStyle: "medium" }),
  }));

  const totalLoans = data.reduce((sum, point) => sum + point.loans, 0);
  const totalReturns = data.reduce((sum, point) => sum + point.returns, 0);

  if (data.length === 0) {
    return (
      <ChartEmpty message={`No circulation window was returned for the last ${days} days.`} />
    );
  }

  return (
    <div>
      <div className="h-64 w-full sm:h-72">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
            <defs>
              <linearGradient id="loansFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={CHART_COLORS.brand} stopOpacity={0.45} />
                <stop offset="100%" stopColor={CHART_COLORS.brand} stopOpacity={0.04} />
              </linearGradient>
              <linearGradient id="returnsFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={CHART_COLORS.gold} stopOpacity={0.5} />
                <stop offset="100%" stopColor={CHART_COLORS.gold} stopOpacity={0.04} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke={CHART_COLORS.grid} strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="label"
              tick={AXIS_TICK}
              tickLine={false}
              axisLine={{ stroke: CHART_COLORS.grid }}
              interval="preserveStartEnd"
              minTickGap={18}
            />
            <YAxis
              allowDecimals={false}
              tick={AXIS_TICK}
              tickLine={false}
              axisLine={false}
              width={44}
            />
            <Tooltip
              content={<ChartTooltip />}
              labelFormatter={(label) => {
                const match = data.find((point) => point.label === label);
                return match?.fullDate ?? String(label);
              }}
            />
            <Area
              type="monotone"
              dataKey="loans"
              name="Books issued"
              stroke={CHART_COLORS.brand}
              strokeWidth={2}
              fill="url(#loansFill)"
              activeDot={{ r: 4, fill: CHART_COLORS.brand }}
            />
            <Area
              type="monotone"
              dataKey="returns"
              name="Books returned"
              stroke={CHART_COLORS.gold}
              strokeWidth={2}
              fill="url(#returnsFill)"
              activeDot={{ r: 4, fill: CHART_COLORS.gold }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span
            aria-hidden
            className="size-2.5 rounded-sm"
            style={{ background: CHART_COLORS.brand }}
          />
          Books issued
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span
            aria-hidden
            className="size-2.5 rounded-sm"
            style={{ background: CHART_COLORS.gold }}
          />
          Books returned
        </span>
      </div>

      <ChartDataSource
        caption={`Books issued and returned per day over the last ${days} days`}
        headers={["Date", "Books issued", "Books returned"]}
        rows={data.map((point) => [point.fullDate, point.loans, point.returns])}
      />

      <p className="mt-2 text-xs leading-relaxed text-ink-soft">
        Over the last {days} days the desk issued {formatNumber(totalLoans)} book(s) and checked in{" "}
        {formatNumber(totalReturns)} book(s)
        {totalReturns > totalLoans
          ? " — returns outpaced issuing, so shelf availability is recovering."
          : totalLoans > totalReturns
            ? " — demand is outrunning check-ins, so expect tighter shelf availability."
            : " — issuing and check-ins are perfectly balanced."}
      </p>

      <p className="mt-2 text-xs">
        <Link
          href="/dashboard/reports"
          className="font-medium text-brand-600 underline-offset-4 hover:underline"
        >
          Export the circulation report
        </Link>
      </p>
    </div>
  );
}
