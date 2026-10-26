import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { COPY_STATUS_LABEL, SECTION_META } from "@/lib/constants";
import { formatPeso } from "@/lib/utils";
import { fineTypeLabel } from "@/components/circulation/section-rule";
import type { LostCopyRow } from "@/server/data/circulation";
import { Boxes } from "lucide-react";

/**
 * Copies the return desk closed as damaged or lost, with the penalty
 * `return_book()` raised against the borrower. Read-only — settlement happens
 * at the fine desk.
 */
export function LostDamagedPanel({ rows }: { rows: LostCopyRow[] }) {
  if (!rows.length) {
    return (
      <EmptyState
        icon={<Boxes className="size-5" />}
        title="No damaged or lost copies"
        description="Every copy on the ledger is accounted for. Damage and loss recorded at check-in appears here."
      />
    );
  }

  const outstanding = rows.reduce((sum, row) => (row.fine_status === "pending" ? sum + row.fine_amount : sum), 0);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-ink-soft">
          {rows.length} copy(ies) off the shelf ·{" "}
          <span className="font-semibold text-ink">{formatPeso(outstanding)}</span> in unsettled
          replacement and repair penalties
        </p>
        <Button asChild variant="outline" size="sm">
          <Link href="/dashboard/fines">Fine desk</Link>
        </Button>
      </div>

      <Table containerClassName="overflow-x-auto rounded-xl border border-border">
        <TableHeader>
          <TableRow>
            <TableHead className="min-w-[15rem]">Copy</TableHead>
            <TableHead className="min-w-[12rem]">Status</TableHead>
            <TableHead className="min-w-[13rem]">Held by</TableHead>
            <TableHead className="min-w-[12rem] text-right">Penalty</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.copy_id} className="align-top">
              <TableCell>
                <p className="font-medium text-ink">{row.title}</p>
                <p className="mt-0.5 text-xs text-ink-soft">{row.author}</p>
                <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                  {row.barcode} · {row.accession_number}
                </p>
              </TableCell>
              <TableCell>
                <Badge variant={row.status === "lost" ? "destructive" : "warning"}>
                  {COPY_STATUS_LABEL[row.status] ?? row.status}
                </Badge>
                <p className="mt-1.5 text-[11px] text-muted-foreground">
                  {SECTION_META[row.section]?.label ?? row.section} · {row.library_name}
                </p>
                {row.condition ? <p className="text-[11px] text-muted-foreground">{row.condition}</p> : null}
              </TableCell>
              <TableCell>
                {row.borrower_name ? (
                  <>
                    <p className="text-sm text-ink">{row.borrower_name}</p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">{row.reference_no ?? "—"}</p>
                  </>
                ) : (
                  <span className="text-xs text-muted-foreground">Borrower not recorded</span>
                )}
              </TableCell>
              <TableCell className="text-right">
                <p className="font-semibold text-ink">{formatPeso(row.fine_amount)}</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {row.fine_type ? fineTypeLabel(row.fine_type) : "No penalty raised"}
                </p>
                {row.fine_status ? (
                  <Badge
                    variant={
                      row.fine_status === "pending"
                        ? "destructive"
                        : row.fine_status === "paid"
                          ? "success"
                          : "secondary"
                    }
                    className="mt-1"
                  >
                    {row.fine_status}
                  </Badge>
                ) : null}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
