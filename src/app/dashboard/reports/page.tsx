import type { Metadata } from "next";
import Link from "next/link";
import { LibraryBig, TrendingUp } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { ReportExport } from "@/components/circulation/report-export";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatTile } from "@/components/ui/stat-tile";
import { SectionHeader } from "@/components/ui/section-header";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SECTION_META } from "@/lib/constants";
import { requireRole } from "@/lib/rbac";
import { formatDate, formatPeso } from "@/lib/utils";
import {
  listBranches,
  listReportRows,
  resolveReportRange,
  summariseReport,
} from "@/server/data/circulation";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Circulation reports",
  description: "Loans issued in a date range, per branch, exportable to CSV and PDF.",
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function single(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

const PREVIEW_ROWS = 150;

export default async function ReportsPage({ searchParams }: { searchParams: SearchParams }) {
  await requireRole("librarian", "admin");
  const params = await searchParams;

  const input = {
    from: single(params.from) ?? "",
    to: single(params.to) ?? "",
    libraryId: single(params.library) ?? "",
  };
  const range = resolveReportRange(input);
  const [branches, rows] = await Promise.all([listBranches(), listReportRows(input)]);
  const summary = summariseReport(rows);
  const branchLabel = input.libraryId
    ? (branches.find((branch) => String(branch.id) === input.libraryId)?.name ?? "Selected branch")
    : "All branches";

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Collection management"
        title="Circulation reports"
        description="Every loan issued in the period, across the elementary, high school and college libraries — with borrower, title, due date and the fine posted."
        actions={
          <ReportExport
            rows={rows}
            from={range.fromValue || range.from.toISOString().slice(0, 10)}
            to={range.toValue || range.to.toISOString().slice(0, 10)}
            branch={branchLabel}
          />
        }
      />

      <form method="get" action="/dashboard/reports" className="surface-card space-y-4 p-4 sm:p-5">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-2">
            <Label htmlFor="from">From</Label>
            <Input id="from" name="from" type="date" defaultValue={input.from} className="h-11" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="to">To</Label>
            <Input id="to" name="to" type="date" defaultValue={input.to} className="h-11" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="library">Branch</Label>
            <select
              id="library"
              name="library"
              defaultValue={input.libraryId}
              className="h-11 w-full rounded-lg border border-input bg-card px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/25"
            >
              <option value="">All branches</option>
              {branches.map((branch) => (
                <option key={branch.id} value={String(branch.id)}>
                  {branch.name} ({branch.code})
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end gap-2">
            <Button type="submit" className="h-11">
              Run the report
            </Button>
            <Button asChild variant="ghost" className="h-11">
              <Link href="/dashboard/reports">Reset</Link>
            </Button>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Showing {formatDate(range.from)} to {formatDate(range.to)} · {branchLabel}. Blank dates
          default to the last 30 days.
        </p>
      </form>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatTile label="Loans issued" value={summary.loans} hint={`${summary.borrowers} borrower(s) served`} />
        <StatTile
          label="Checked in"
          value={summary.returned}
          tone="success"
          hint={`${summary.outstanding} still out`}
        />
        <StatTile
          label="Overdue in range"
          value={summary.overdue}
          tone={summary.overdue ? "danger" : "default"}
          hint="Past the due date at the time of running"
        />
        <StatTile
          label="Fines posted"
          value={formatPeso(summary.fines)}
          tone="gold"
          hint="Charged by the policy engine on these loans"
        />
        <StatTile label="Outstanding loans" value={summary.outstanding} hint="Copy not back on the shelf yet" />
        <StatTile
          label="Most borrowed"
          value={summary.topTitles[0]?.loans ?? 0}
          hint={summary.topTitles[0]?.title ?? "No loans in this range"}
        />
      </div>

      {summary.topTitles.length ? (
        <section className="surface-card p-5">
          <SectionHeader
            title="Most borrowed titles"
            description="Ranked by loans issued inside the selected period."
          />
          <ol className="mt-3 space-y-2">
            {summary.topTitles.map((title, index) => (
              <li
                key={title.title}
                className="flex items-center justify-between gap-3 rounded-lg bg-muted/60 px-3 py-2"
              >
                <span className="flex min-w-0 items-center gap-3">
                  <span className="grid size-7 shrink-0 place-items-center rounded-full bg-brand-100 text-xs font-semibold text-brand-800">
                    {index + 1}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-ink">{title.title}</span>
                    <span className="block truncate text-xs text-ink-soft">{title.author}</span>
                  </span>
                </span>
                <Badge variant="secondary">{title.loans} loan(s)</Badge>
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 font-serif text-lg text-ink">
            <LibraryBig className="size-4 text-brand-600" /> Transactions
          </h2>
          <p className="text-xs text-muted-foreground">
            {rows.length > PREVIEW_ROWS
              ? `First ${PREVIEW_ROWS} of ${rows.length} rows on screen — the CSV and PDF carry all ${rows.length}.`
              : `${rows.length} row(s).`}
          </p>
        </div>

        {!rows.length ? (
          <EmptyState
            title="No loan was issued in this range"
            description="Widen the dates, or choose another branch."
          />
        ) : (
          <Table containerClassName="overflow-x-auto rounded-xl border border-border">
            <TableHeader>
              <TableRow>
                <TableHead>Reference</TableHead>
                <TableHead className="min-w-[13rem]">Borrower</TableHead>
                <TableHead className="min-w-[14rem]">Title</TableHead>
                <TableHead>Borrowed</TableHead>
                <TableHead>Due</TableHead>
                <TableHead>Returned</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Fine</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.slice(0, PREVIEW_ROWS).map((row) => (
                <TableRow key={row.id} className="align-top">
                  <TableCell className="font-mono text-xs">{row.reference_no}</TableCell>
                  <TableCell>
                    <p className="text-sm text-ink">{row.borrower_name}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {row.sbtr_number ? `SBTR ${row.sbtr_number} · ` : ""}
                      {row.library_name}
                    </p>
                  </TableCell>
                  <TableCell>
                    <p className="text-sm text-ink">{row.book_title}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {row.accession_number} · {SECTION_META[row.section]?.label ?? row.section}
                      {row.librarian_name ? ` · issued by ${row.librarian_name}` : ""}
                    </p>
                  </TableCell>
                  <TableCell className="text-xs">{formatDate(row.date_borrowed)}</TableCell>
                  <TableCell className="text-xs">{formatDate(row.due_date)}</TableCell>
                  <TableCell className="text-xs">
                    {row.date_returned ? formatDate(row.date_returned) : "—"}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        row.status === "overdue"
                          ? "destructive"
                          : row.status === "returned"
                            ? "success"
                            : row.status === "lost" || row.status === "damaged"
                              ? "warning"
                              : "info"
                      }
                    >
                      {row.status}
                    </Badge>
                    {row.overdue_days > 0 ? (
                      <p className="mt-1 text-[11px] text-destructive">{row.overdue_days} day(s) late</p>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-right text-sm text-ink">{formatPeso(row.fine_charged)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>

      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <TrendingUp className="size-3.5" />
        For trends and branch usage charts, open Analytics.
        <Link href="/dashboard/analytics" className="underline underline-offset-4">
          Go to Analytics
        </Link>
      </p>
    </div>
  );
}
