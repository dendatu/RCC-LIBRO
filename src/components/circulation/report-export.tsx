"use client";

import * as React from "react";
import { FileDown, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { downloadBorrowingHistory } from "@/lib/pdf";
import type { ReportRow } from "@/server/data/circulation";

const COLUMNS: { key: keyof ReportRow; header: string }[] = [
  { key: "reference_no", header: "Reference" },
  { key: "date_borrowed", header: "Date borrowed" },
  { key: "due_date", header: "Due date" },
  { key: "date_returned", header: "Date returned" },
  { key: "status", header: "Status" },
  { key: "borrower_name", header: "Borrower" },
  { key: "sbtr_number", header: "SBTR" },
  { key: "borrower_email", header: "E-mail" },
  { key: "book_title", header: "Title" },
  { key: "book_author", header: "Author" },
  { key: "accession_number", header: "Accession" },
  { key: "call_number", header: "Call number" },
  { key: "barcode", header: "Copy barcode" },
  { key: "section", header: "Section" },
  { key: "library_name", header: "Branch" },
  { key: "librarian_name", header: "Issued by" },
  { key: "overdue_days", header: "Days overdue" },
  { key: "fine_charged", header: "Fine" },
];

function csvCell(value: unknown) {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** Client-side exports for the circulation report — CSV blob and the PDF sheet. */
export function ReportExport({
  rows,
  from,
  to,
  branch,
}: {
  rows: ReportRow[];
  from: string;
  to: string;
  branch: string;
}) {
  const exportCsv = () => {
    if (!rows.length) {
      toast.message("Nothing to export for this range.");
      return;
    }
    const lines = [
      COLUMNS.map((column) => csvCell(column.header)).join(","),
      ...rows.map((row) => COLUMNS.map((column) => csvCell(row[column.key])).join(",")),
    ];
    const blob = new Blob([`\uFEFF${lines.join("\r\n")}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `rcc-circulation-${from || "all"}-${to || "all"}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    toast.success(`${rows.length} row(s) exported to CSV.`);
  };

  const exportPdf = () => {
    if (!rows.length) {
      toast.message("Nothing to export for this range.");
      return;
    }
    downloadBorrowingHistory(
      {
        name: `Circulation report — ${branch}`,
        email: `${from || "beginning"} to ${to || "today"}`,
        classification: `${rows.length} transaction(s) recorded`,
      },
      rows.map((row) => ({
        reference_no: row.reference_no,
        title: row.book_title,
        accession_number: row.accession_number,
        date_borrowed: row.date_borrowed,
        due_date: row.due_date,
        date_returned: row.date_returned,
        status: row.status,
        fine: row.fine_charged,
      })),
    );
  };

  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="secondary" onClick={exportCsv}>
        <FileSpreadsheet className="size-4" /> Export CSV
      </Button>
      <Button variant="gold" onClick={exportPdf}>
        <FileDown className="size-4" /> Download PDF
      </Button>
    </div>
  );
}
