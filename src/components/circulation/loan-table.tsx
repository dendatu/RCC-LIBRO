"use client";

import * as React from "react";
import { ArrowDownUp, CalendarX2, Undo2 } from "lucide-react";
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
import { SECTION_META } from "@/lib/constants";
import { formatDate, relativeDue } from "@/lib/utils";
import type { DeskLoan } from "@/server/data/circulation";

function dueBadge(loan: DeskLoan) {
  if (loan.status === "overdue" || loan.is_overdue) {
    return <Badge variant="destructive">{relativeDue(loan.due_date)}</Badge>;
  }
  const days = loan.days_left;
  if (days < 0) return <Badge variant="destructive">{relativeDue(loan.due_date)}</Badge>;
  if (days === 0) return <Badge variant="warning">Due today</Badge>;
  if (days <= 1) return <Badge variant="warning">{relativeDue(loan.due_date)}</Badge>;
  return <Badge variant="secondary">{relativeDue(loan.due_date)}</Badge>;
}

/** Open loans on the desk ledger: check-in and extension are one tap each. */
export function LoanTable({
  loans,
  onReturn,
  onExtend,
  emptyTitle = "No loans on the ledger",
  emptyDescription = "Every copy is back on the shelf at this branch.",
}: {
  loans: DeskLoan[];
  onReturn?: (loan: DeskLoan) => void;
  onExtend?: (loan: DeskLoan) => void;
  emptyTitle?: string;
  emptyDescription?: string;
}) {
  if (!loans.length) {
    return (
      <EmptyState
        icon={<CalendarX2 className="size-5" />}
        title={emptyTitle}
        description={emptyDescription}
      />
    );
  }

  return (
    <Table containerClassName="overflow-x-auto rounded-xl border border-border">
      <TableHeader>
        <TableRow>
          <TableHead className="min-w-[15rem]">Borrower</TableHead>
          <TableHead className="min-w-[16rem]">Title</TableHead>
          <TableHead className="min-w-[10rem]">Due</TableHead>
          <TableHead className="min-w-[12rem]">Desk actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {loans.map((loan) => (
          <TableRow key={loan.id} className="align-top">
            <TableCell>
              <p className="font-medium text-ink">{loan.borrower_name}</p>
              <p className="mt-0.5 text-xs text-ink-soft">{loan.classification}</p>
              <p className="mt-1 flex flex-wrap gap-x-2 text-[11px] text-muted-foreground">
                <span>{loan.reference_no}</span>
                {loan.sbtr_number ? <span>SBTR {loan.sbtr_number}</span> : null}
                {loan.borrower_card ? <span>Card {loan.borrower_card}</span> : null}
              </p>
            </TableCell>
            <TableCell>
              <p className="font-medium text-ink">{loan.book_title}</p>
              <p className="mt-0.5 truncate text-xs text-ink-soft">{loan.book_author}</p>
              <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
                <span className="font-mono">{loan.barcode ?? "—"}</span>
                <span>· {loan.accession_number}</span>
                <span>· {loan.library_name}</span>
                <span className={SECTION_META[loan.section]?.hue ?? ""}>
                  {SECTION_META[loan.section]?.label ?? loan.section}
                </span>
              </p>
            </TableCell>
            <TableCell>
              <p className="text-sm font-medium text-ink">{formatDate(loan.due_date)}</p>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {dueBadge(loan)}
                {loan.status === "overdue" || loan.overdue_days > 0 ? (
                  <Badge variant="outline">{loan.overdue_days} d late</Badge>
                ) : null}
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Out since {formatDate(loan.date_borrowed)}
                {loan.renewals_used > 0 ? ` · ${loan.renewals_used} renewal(s)` : ""}
              </p>
            </TableCell>
            <TableCell>
              <div className="flex flex-wrap gap-2">
                {onReturn ? (
                  <Button size="sm" onClick={() => onReturn(loan)}>
                    <Undo2 className="size-3.5" /> Check in
                  </Button>
                ) : null}
                {onExtend ? (
                  <Button size="sm" variant="outline" onClick={() => onExtend(loan)}>
                    <ArrowDownUp className="size-3.5" /> Extend
                  </Button>
                ) : null}
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
