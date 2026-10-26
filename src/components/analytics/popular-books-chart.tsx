"use client";

import {
  Bar,
  BarChart,
  Cell,
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
  seriesColor,
} from "./chart-frame";

export interface PopularBookPoint {
  book_id: string;
  title: string;
  author: string;
  loans: number;
  library_name: string;
}

function truncate(value: string, max: number) {
  return value.length <= max ? value : `${value.slice(0, max - 1).trimEnd()}…`;
}

export function PopularBooksChart({ books }: { books: PopularBookPoint[] }) {
  if (books.length === 0) {
    return (
      <ChartEmpty message="No loans have been recorded yet, so there are no popular titles to rank." />
    );
  }

  const ranked = [...books].sort((a, b) => b.loans - a.loans);
  const axisWidth = 132;
  const data = ranked.map((book) => ({
    ...book,
    label: truncate(book.title, 22),
  }));

  const leader = ranked[0];
  const totalLoans = ranked.reduce((sum, book) => sum + book.loans, 0);

  return (
    <div>
      <div style={{ height: Math.max(200, data.length * 34) }} className="w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 4, right: 24, bottom: 4, left: 4 }}>
            <XAxis
              type="number"
              allowDecimals={false}
              tick={AXIS_TICK}
              tickLine={false}
              axisLine={{ stroke: CHART_COLORS.grid }}
            />
            <YAxis
              type="category"
              dataKey="label"
              width={axisWidth}
              tick={{ fill: CHART_COLORS.ink, fontSize: 11 }}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip
              cursor={{ fill: "rgba(111, 78, 55, 0.06)" }}
              content={
                <ChartTooltip
                  format={(value, entry) =>
                    `${formatNumber(value)} loan(s) · ${String(entry.payload?.author ?? "")}`
                  }
                />
              }
            />
            <Bar dataKey="loans" name="Loans" radius={[0, 6, 6, 0]} barSize={16}>
              {data.map((book, index) => (
                <Cell key={book.book_id} fill={seriesColor(index)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <ChartDataSource
        caption="Most borrowed titles by number of loans"
        headers={["Title", "Author", "Branch", "Loans"]}
        rows={ranked.map((book) => [book.title, book.author, book.library_name, book.loans])}
      />

      <p className="mt-2 text-xs leading-relaxed text-ink-soft">
        <span className="font-semibold text-ink">{leader.title}</span> leads with{" "}
        {formatNumber(leader.loans)} loan(s) at the {leader.library_name}. These{" "}
        {ranked.length} titles account for {formatNumber(totalLoans)} loan(s) in total — keep a
        spare copy of each on the hold shelf.
      </p>
    </div>
  );
}
