import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { History } from "lucide-react";
import { formatDate, formatPeso } from "@/lib/utils";
import type { BorrowHistoryRow } from "@/server/data/catalog";

const statusVariant: Record<string, "success" | "info" | "warning" | "destructive" | "secondary"> = {
  active: "info",
  returned: "success",
  overdue: "destructive",
  lost: "destructive",
  damaged: "warning",
  cancelled: "secondary",
};

/**
 * Rendering of `book_borrowing_history_view`. Row visibility already follows RLS:
 * borrowers only receive their own loans, staff receive the full ledger.
 */
export function LoanHistoryTable({ rows, hideTitle = false }: { rows: BorrowHistoryRow[]; hideTitle?: boolean }) {
  if (rows.length === 0) {
    return (
      <EmptyState
        icon={<History className="size-6" />}
        title="No lending history yet"
        description="This copy has not been issued from the circulation desk, or its loans are outside your access."
      />
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Borrower</TableHead>
          {hideTitle ? null : <TableHead className="hidden sm:table-cell">Title</TableHead>}
          <TableHead className="hidden md:table-cell">Barcode</TableHead>
          <TableHead>Borrowed</TableHead>
          <TableHead>Due</TableHead>
          <TableHead className="hidden lg:table-cell">Returned</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Fine</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.id}>
            <TableCell>
              <p className="truncate text-sm font-medium text-ink">{row.borrower_name}</p>
              <p className="truncate text-[11px] text-muted-foreground">
                {row.borrower_classification ?? "Unclassified"}
                {row.section ? ` · Section ${row.section}` : ""}
              </p>
            </TableCell>
            {hideTitle ? null : (
              <TableCell className="hidden max-w-52 truncate text-sm text-ink-soft sm:table-cell">
                {row.title}
              </TableCell>
            )}
            <TableCell className="hidden font-mono text-xs text-ink-soft md:table-cell">
              {row.barcode ?? "—"}
            </TableCell>
            <TableCell className="text-xs text-ink-soft">{formatDate(row.date_borrowed)}</TableCell>
            <TableCell className="text-xs text-ink-soft">{formatDate(row.due_date)}</TableCell>
            <TableCell className="hidden text-xs text-ink-soft lg:table-cell">
              {row.date_returned ? formatDate(row.date_returned) : "Not returned"}
            </TableCell>
            <TableCell>
              <Badge variant={statusVariant[row.status] ?? "secondary"}>{row.status}</Badge>
              {row.return_condition && row.return_condition !== "good" ? (
                <span className="ml-1 text-[11px] text-warning">({row.return_condition})</span>
              ) : null}
            </TableCell>
            <TableCell className="text-right text-xs tabular-nums text-ink-soft">
              {Number(row.fine_assessed ?? 0) > 0 ? formatPeso(row.fine_assessed) : "—"}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
