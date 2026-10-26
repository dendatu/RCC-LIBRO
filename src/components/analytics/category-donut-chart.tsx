"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { formatNumber } from "@/lib/utils";
import { CHART_COLORS, ChartDataSource, ChartEmpty, ChartTooltip, seriesColor } from "./chart-frame";

export interface CategoryPoint {
  category: string;
  loans: number;
  titles: number;
}

export function CategoryDonutChart({ categories }: { categories: CategoryPoint[] }) {
  if (categories.length === 0) {
    return (
      <ChartEmpty message="Loans are not tagged by subject category yet, so the mix cannot be drawn." />
    );
  }

  const data = categories.map((row) => ({ ...row, label: row.category }));
  const total = data.reduce((sum, row) => sum + row.loans, 0);

  return (
    <div>
      <div className="h-56 w-full sm:h-64">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Tooltip
              content={
                <ChartTooltip
                  format={(value) =>
                    `${formatNumber(value)} loan(s) · ${((value / Math.max(total, 1)) * 100).toFixed(1)}%`
                  }
                />
              }
            />
            <Pie
              data={data}
              dataKey="loans"
              nameKey="label"
              innerRadius="58%"
              outerRadius="88%"
              paddingAngle={2}
              strokeWidth={2}
              stroke="#FFFFFF"
            >
              {data.map((row, index) => (
                <Cell key={row.category} fill={seriesColor(index)} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      </div>

      <ul className="mt-4 grid gap-2 sm:grid-cols-2">
        {data.map((row, index) => (
          <li key={row.category} className="flex items-center gap-2 text-xs">
            <span
              aria-hidden
              className="size-2.5 shrink-0 rounded-full"
              style={{ background: seriesColor(index) }}
            />
            <span className="min-w-0 flex-1 truncate text-ink" title={row.category}>
              {row.category}
            </span>
            <span className="font-semibold tabular-nums text-ink">
              {((row.loans / Math.max(total, 1)) * 100).toFixed(0)}%
            </span>
            <span className="w-14 text-right tabular-nums text-muted-foreground">
              {formatNumber(row.loans)} loans
            </span>
          </li>
        ))}
      </ul>

      <ChartDataSource
        caption="Loans by subject category"
        headers={["Category", "Loans", "Titles borrowed"]}
        rows={data.map((row) => [row.category, row.loans, row.titles])}
      />

      <p className="mt-2 text-xs leading-relaxed text-ink-soft">
        {formatNumber(total)} loan(s) across {data.length} subject categor(ies).{" "}
        <strong className="font-semibold text-ink">{data[0].category}</strong> carries{" "}
        {((data[0].loans / Math.max(total, 1)) * 100).toFixed(0)}% of all circulation — weight
        purchasing and displays around it.
      </p>
      <p className="mt-1 text-[11px] text-muted-foreground" style={{ color: CHART_COLORS.axis }}>
        Titles are counted once per distinct catalogue record.
      </p>
    </div>
  );
}
