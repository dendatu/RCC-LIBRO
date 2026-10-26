"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatNumber } from "@/lib/utils";
import {
  AXIS_TICK,
  CHART_COLORS,
  ChartDataSource,
  ChartEmpty,
  ChartTooltip,
} from "./chart-frame";

export interface BranchUsagePoint {
  library_id: number;
  library: string;
  titles: number;
  copies: number;
  active_loans: number;
  overdue: number;
}

function shortName(name: string) {
  return name
    .replace("College and Graduate School Library", "College & Graduate")
    .replace(" Library", "")
    .trim();
}

export function BranchUsageChart({ branches }: { branches: BranchUsagePoint[] }) {
  if (branches.length === 0) {
    return <ChartEmpty message="No library branches are configured, so usage cannot be compared." />;
  }

  const data = branches.map((branch) => ({ ...branch, label: shortName(branch.library) }));
  const busiest = data.reduce(
    (best, branch) => (branch.active_loans > best.active_loans ? branch : best),
    data[0],
  );

  return (
    <div>
      <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: -22 }}>
            <CartesianGrid stroke={CHART_COLORS.grid} strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="label"
              tick={AXIS_TICK}
              tickLine={false}
              axisLine={{ stroke: CHART_COLORS.grid }}
              interval={0}
            />
            <YAxis
              yAxisId="holdings"
              tick={AXIS_TICK}
              tickLine={false}
              axisLine={false}
              width={52}
            />
            <YAxis
              yAxisId="activity"
              orientation="right"
              tick={AXIS_TICK}
              tickLine={false}
              axisLine={false}
              width={40}
            />
            <Tooltip
              cursor={{ fill: "rgba(111, 78, 55, 0.06)" }}
              content={<ChartTooltip />}
            />
            <Legend
              verticalAlign="bottom"
              height={28}
              iconType="circle"
              wrapperStyle={{ fontSize: 11, color: CHART_COLORS.axis }}
            />
            <Bar
              yAxisId="holdings"
              dataKey="titles"
              name="Titles"
              fill={CHART_COLORS.caramel}
              radius={[4, 4, 0, 0]}
              maxBarSize={26}
            />
            <Bar
              yAxisId="holdings"
              dataKey="copies"
              name="Copies"
              fill={CHART_COLORS.brand}
              radius={[4, 4, 0, 0]}
              maxBarSize={26}
            />
            <Bar
              yAxisId="activity"
              dataKey="active_loans"
              name="Active loans"
              fill={CHART_COLORS.gold}
              radius={[4, 4, 0, 0]}
              maxBarSize={26}
            />
            <Bar
              yAxisId="activity"
              dataKey="overdue"
              name="Overdue"
              fill={CHART_COLORS.amber}
              radius={[4, 4, 0, 0]}
              maxBarSize={26}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <ChartDataSource
        caption="Holdings and circulation per branch library"
        headers={["Branch", "Titles", "Copies", "Active loans", "Overdue"]}
        rows={data.map((branch) => [
          branch.library,
          branch.titles,
          branch.copies,
          branch.active_loans,
          branch.overdue,
        ])}
      />

      <ul className="mt-3 grid gap-2 sm:grid-cols-3">
        {data.map((branch) => (
          <li key={branch.library_id} className="rounded-lg bg-muted/60 px-3 py-2">
            <p className="truncate text-xs font-semibold text-ink" title={branch.library}>
              {branch.library}
            </p>
            <p className="mt-1 text-[11px] tabular-nums text-muted-foreground">
              {formatNumber(branch.titles)} titles · {formatNumber(branch.copies)} copies ·{" "}
              {formatNumber(branch.active_loans)} out · {formatNumber(branch.overdue)} overdue
            </p>
          </li>
        ))}
      </ul>

      <p className="mt-2 text-xs leading-relaxed text-ink-soft">
        Left axis measures holdings, right axis measures circulation.{" "}
        <strong className="font-semibold text-ink">{busiest.library}</strong> carries the heaviest
        live load with {formatNumber(busiest.active_loans)} loan(s) outstanding.
      </p>
    </div>
  );
}
