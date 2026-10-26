import type { Metadata } from "next";
import Link from "next/link";
import { History, Search } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusPill } from "@/components/circulation/status-pill";
import { HistoryPdfButton } from "@/components/circulation/pdf-download";
import { requireMember } from "@/lib/rbac";
import { historyRows } from "@/server/data/member";
import { listBranches } from "@/server/data/circulation";
import { SECTION_META, classificationLabel } from "@/lib/constants";
import { formatDate, formatPeso } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Transaction history",
  description: "Every loan under your name, returned included, exportable to PDF.",
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function single(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function HistoryPage({ searchParams }: { searchParams: SearchParams }) {
  const member = await requireMember();
  const params = await searchParams;

  const from = single(params.from)?.trim() ?? "";
  const to = single(params.to)?.trim() ?? "";
  const branch = single(params.branch)?.trim() ?? "";

  const [rows, branches] = await Promise.all([
    historyRows(member.user.id, {
      from: from || undefined,
      to: to || undefined,
    }),
    listBranches(),
  ]);

  const filtered = branch ? rows.filter((row) => row.library_name === branch) : rows;

  const info = {
    name: member.user.full_name,
    email: member.user.email,
    classification: classificationLabel(member.profile ?? {}),
    sbtr: member.profile?.sbtr_number ?? null,
    card: member.profile?.card_number ?? null,
  };

  const pdfRows = filtered.map((row) => ({
    reference_no: row.reference_no,
    title: row.book_title,
    accession_number: row.accession_number,
    date_borrowed: row.date_borrowed,
    due_date: row.due_date,
    date_returned: row.date_returned,
    status: row.status,
    fine: Number(row.fine_charged ?? 0),
  }));

  const hasFilters = Boolean(from || to || branch);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="My library"
        title="Transaction history"
        description="Every loan issued to you, returned or not. Narrow it by date range or branch, then export the list."
        actions={
          filtered.length > 0 ? <HistoryPdfButton info={info} rows={pdfRows} /> : null
        }
      />

      <form method="get" className="surface-card flex flex-wrap items-end gap-3 p-4">
        <div className="space-y-1">
          <label htmlFor="from" className="text-xs font-medium text-muted-foreground">From</label>
          <Input type="date" id="from" name="from" defaultValue={from} className="w-auto" />
        </div>
        <div className="space-y-1">
          <label htmlFor="to" className="text-xs font-medium text-muted-foreground">To</label>
          <Input type="date" id="to" name="to" defaultValue={to} className="w-auto" />
        </div>
        <div className="space-y-1">
          <label htmlFor="branch" className="text-xs font-medium text-muted-foreground">Branch</label>
          <select
            id="branch"
            name="branch"
            defaultValue={branch}
            className="h-9 rounded-lg border border-input bg-card px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/25"
          >
            <option value="">All branches</option>
            {branches.map((lib) => (
              <option key={lib.id} value={lib.name}>
                {lib.name}
              </option>
            ))}
          </select>
        </div>
        <Button type="submit">
          <Search className="size-4" /> Apply
        </Button>
        {hasFilters ? (
          <Button asChild variant="ghost">
            <Link href="/dashboard/history">Reset</Link>
          </Button>
        ) : null}
      </form>

      <p className="text-sm text-muted-foreground">
        {filtered.length} loan(s) shown{hasFilters ? " for the selected filters" : ""}.
      </p>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<History className="size-7" />}
          title="No loans match"
          description="Try widening the date range or clearing the branch filter. Newly issued loans appear as soon as the desk releases them."
        />
      ) : (
        <div className="surface-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-secondary text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-semibold">Reference</th>
                <th className="px-4 py-3 font-semibold">Title</th>
                <th className="px-4 py-3 font-semibold">Borrowed</th>
                <th className="px-4 py-3 font-semibold">Due</th>
                <th className="px-4 py-3 font-semibold">Returned</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 text-right font-semibold">Fine</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((row) => (
                <tr key={row.id} className="align-top transition-colors hover:bg-muted/60">
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{row.reference_no}</td>
                  <td className="px-4 py-3">
                    <p className="max-w-[18rem] truncate font-medium text-ink">{row.book_title}</p>
                    <p className="text-xs text-muted-foreground">
                      {row.accession_number} · {SECTION_META[row.section]?.label ?? row.library_name}
                    </p>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">{formatDate(row.date_borrowed)}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{formatDate(row.due_date)}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{row.date_returned ? formatDate(row.date_returned) : "—"}</td>
                  <td className="px-4 py-3"><StatusPill status={row.status} /></td>
                  <td className={`px-4 py-3 text-right tabular-nums ${row.fine_charged > 0 ? "text-danger" : "text-muted-foreground"}`}>
                    {formatPeso(row.fine_charged)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
