"use client";

import * as React from "react";
import { CircleCheckBig, Printer, RotateCcw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SectionRule } from "@/components/circulation/section-rule";
import { formatDateTime, relativeDue } from "@/lib/utils";
import { INSTITUTION } from "@/lib/constants";
import type { BorrowReceipt } from "@/server/actions/circulation";

/** Desk receipt for a completed loan — printable at the counter. */
export function ReceiptCard({
  receipt,
  onBorrowAnother,
}: {
  receipt: BorrowReceipt;
  onBorrowAnother: () => void;
}) {
  const lines = [
    { label: "Borrower", value: receipt.borrowerName || "—" },
    { label: "Barcode", value: receipt.barcode ?? "—" },
    { label: "Accession no.", value: receipt.accessionNumber || "—" },
    { label: "Author", value: receipt.author || "—" },
    { label: "Issued", value: formatDateTime(receipt.issuedAt ?? receipt.dueDate) },
  ];

  return (
    <div className="rounded-xl border border-success/35 bg-card p-5 shadow-[var(--shadow-card)] print:border-brand-300 print:shadow-none">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 text-success">
          <CircleCheckBig className="size-5" aria-hidden />
          <p className="font-serif text-lg text-ink">Loan released</p>
        </div>
        <Badge variant="success">{relativeDue(receipt.dueDate)}</Badge>
      </div>

      <p className="mt-4 font-mono text-xs tracking-widest text-muted-foreground uppercase">
        Reference {receipt.referenceNo}
      </p>
      <p className="mt-1 font-serif text-xl text-ink">{receipt.title}</p>

      <dl className="mt-4 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
        {lines.map((line) => (
          <div key={line.label} className="flex items-baseline justify-between gap-3 border-b border-dashed border-border pb-1">
            <dt className="text-xs text-muted-foreground">{line.label}</dt>
            <dd className="truncate text-right font-medium text-ink">{line.value}</dd>
          </div>
        ))}
        <div className="flex items-baseline justify-between gap-3 border-b border-dashed border-border pb-1 sm:col-span-2">
          <dt className="text-xs text-muted-foreground">Return on or before</dt>
          <dd className="font-serif text-base font-semibold text-brand-700">
            {formatDateTime(receipt.dueDate)}
          </dd>
        </div>
      </dl>

      <SectionRule section={receipt.section} className="mt-4" />

      <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
        {INSTITUTION} · Keep this reference number for follow-up at the desk. Fines are assessed
        automatically by the library system on late return.
      </p>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row print:hidden">
        <Button variant="gold" size="lg" className="flex-1" onClick={() => window.print()}>
          <Printer className="size-4" /> Print receipt
        </Button>
        <Button variant="outline" size="lg" className="flex-1" onClick={onBorrowAnother}>
          <RotateCcw className="size-4" /> Borrow another
        </Button>
      </div>
    </div>
  );
}
