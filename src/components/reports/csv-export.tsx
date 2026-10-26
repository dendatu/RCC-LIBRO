"use client";

import { useCallback, useState } from "react";
import { Download, Table2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toCsvMatrix, type CsvMatrixReport } from "@/lib/csv";

const PREVIEW_ROWS = 10;

export function CsvExport({ report, emptyMessage }: { report: CsvMatrixReport; emptyMessage?: string }) {
  const [busy, setBusy] = useState(false);
  const rowCount = report.rows.length;

  const download = useCallback(() => {
    setBusy(true);
    try {
      const csv = toCsvMatrix(report.headers, report.rows);
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = report.filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } finally {
      setBusy(false);
    }
  }, [report]);

  if (rowCount === 0) {
    return (
      <div className="rounded-xl border border-dashed border-brand-200 bg-parchment px-6 py-10 text-center">
        <p className="text-sm text-muted-foreground">{emptyMessage ?? "No rows matched this report for the selected range."}</p>
      </div>
    );
  }

  const preview = report.rows.slice(0, PREVIEW_ROWS);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-sm text-ink-soft">
          <Table2 className="size-4 text-brand-500" />
          <span className="font-medium tabular-nums text-ink">{rowCount.toLocaleString("en-PH")}</span> row(s) ·{" "}
          {report.headers.length} columns
        </p>
        <Button size="sm" onClick={download} disabled={busy}>
          <Download className="size-4" /> Download CSV
        </Button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-[var(--shadow-card)]">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-border bg-secondary text-left">
              {report.headers.map((header) => (
                <th key={header} className="whitespace-nowrap px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {preview.map((row, index) => (
              <tr key={index} className="odd:bg-parchment/40">
                {report.headers.map((_, cellIndex) => (
                  <td key={cellIndex} className="whitespace-nowrap px-3 py-2 text-ink-soft tabular-nums">
                    {row[cellIndex] ?? ""}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {rowCount > PREVIEW_ROWS ? (
        <p className="text-xs text-muted-foreground">
          Showing the first {PREVIEW_ROWS} of {rowCount.toLocaleString("en-PH")} rows. The downloaded CSV contains all of
          them.
        </p>
      ) : null}
    </div>
  );
}
