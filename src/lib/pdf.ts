"use client";

import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { APP_NAME, INSTITUTION } from "@/lib/constants";
import { formatDate, formatPeso } from "@/lib/utils";

interface HeaderInfo {
  name: string;
  email: string;
  classification: string;
  sbtr?: string | null;
  card?: string | null;
}

function brandHeader(doc: jsPDF, title: string, info: HeaderInfo) {
  doc.setFillColor(111, 78, 55);
  doc.rect(0, 0, doc.internal.pageSize.getWidth(), 26, "F");
  doc.setTextColor(245, 240, 230);
  doc.setFont("times", "bold");
  doc.setFontSize(15);
  doc.text(APP_NAME, 14, 12);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.text(INSTITUTION, 14, 19);

  doc.setTextColor(45, 45, 45);
  doc.setFont("times", "bold");
  doc.setFontSize(14);
  doc.text(title, 14, 38);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`${info.name}  ·  ${info.classification}`, 14, 45);
  doc.text(
    `${info.email}${info.sbtr ? `  ·  SBTR ${info.sbtr}` : ""}${info.card ? `  ·  Card ${info.card}` : ""}`,
    14,
    50.5,
  );
  doc.text(`Generated ${new Date().toLocaleString("en-PH")}`, 14, 56);
}

function footer(doc: jsPDF, note: string) {
  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page += 1) {
    doc.setPage(page);
    const height = doc.internal.pageSize.getHeight();
    doc.setFontSize(7.5);
    doc.setTextColor(122, 114, 106);
    doc.text(note, 14, height - 10);
    doc.text(`Page ${page} of ${pages}`, doc.internal.pageSize.getWidth() - 14, height - 10, {
      align: "right",
    });
  }
}

/** y position just under the last autoTable drawn on the document. */
function afterTable(doc: jsPDF) {
  const table = (doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable;
  return (table?.finalY ?? 80) + 10;
}

const TABLE_STYLE = {
  headFillColor: [111, 78, 55] as [number, number, number],
  headTextColor: [245, 240, 230] as [number, number, number],
  styles: { fontSize: 8.5, cellPadding: 2.4 },
  alternateRowStyles: { fillColor: [251, 248, 242] as [number, number, number] },
};

/** "Download borrowing history PDF" for borrowers. */
export function downloadBorrowingHistory(
  info: HeaderInfo,
  rows: {
    reference_no: string;
    title: string;
    accession_number: string;
    date_borrowed: string;
    due_date: string;
    date_returned: string | null;
    status: string;
    fine: number;
  }[],
) {
  const doc = new jsPDF();
  brandHeader(doc, "Borrowing History", info);
  autoTable(doc, {
    ...TABLE_STYLE,
    startY: 62,
    head: [["Reference", "Title", "Accession", "Borrowed", "Due", "Returned", "Status", "Fine"]],
    body: rows.map((row) => [
      row.reference_no,
      row.title,
      row.accession_number,
      formatDate(row.date_borrowed),
      formatDate(row.due_date),
      row.date_returned ? formatDate(row.date_returned) : "—",
      row.status,
      formatPeso(row.fine),
    ]),
    columnStyles: { 0: { cellWidth: 30 }, 2: { cellWidth: 26 }, 7: { halign: "right" } },
  });
  const total = rows.reduce((sum, row) => sum + Number(row.fine ?? 0), 0);
  doc.setFontSize(9);
  doc.text(`Total fines recorded: ${formatPeso(total)}`, 14, afterTable(doc));
  footer(doc, "RCC LIBRO · borrowing privileges require an active SBTR and no unresolved penalties.");
  doc.save(`rcc-borrowing-history-${Date.now()}.pdf`);
}

/** Digital SBTR (Student Book Tracer Record) sheet. */
export function downloadSbtr(
  info: HeaderInfo,
  rows: {
    title: string;
    accession_number: string;
    date_borrowed: string;
    due_date: string;
    date_returned: string | null;
    librarian: string;
  }[],
) {
  const doc = new jsPDF();
  brandHeader(doc, "Student Book Tracer Record (SBTR)", info);
  autoTable(doc, {
    ...TABLE_STYLE,
    startY: 62,
    head: [["#", "Book Title", "Accession No.", "Date Borrowed", "Due Date", "Date Returned", "Recorded by"]],
    body: rows.map((row, index) => [
      String(index + 1),
      row.title,
      row.accession_number,
      formatDate(row.date_borrowed),
      formatDate(row.due_date),
      row.date_returned ? formatDate(row.date_returned) : "Not returned",
      row.librarian,
    ]),
  });
  const y = afterTable(doc) + 6;
  doc.setFontSize(8.5);
  doc.text("Borrower's signature: ______________________________", 14, y);
  doc.text("Librarian's signature: ______________________________", 120, y);
  doc.text(
    "Fine: PHP 1.00 per day overdue (weekends and holidays included). Reserve books: PHP 2.00 per hour.",
    14,
    y + 8,
  );
  footer(doc, "Digital SBTR issued by RCC LIBRO — the paper tracer record remains the property of the library.");
  doc.save(`rcc-sbtr-${Date.now()}.pdf`);
}

/** Fine statement for the circulation desk. */
export function downloadFineStatement(
  info: HeaderInfo,
  rows: { type: string; book: string; amount: number; status: string; created: string }[],
) {
  const doc = new jsPDF();
  brandHeader(doc, "Statement of Penalties", info);
  autoTable(doc, {
    ...TABLE_STYLE,
    startY: 62,
    head: [["Date", "Type", "Title", "Amount", "Status"]],
    body: rows.map((row) => [
      formatDate(row.created),
      row.type.replace(/_/g, " "),
      row.book,
      formatPeso(row.amount),
      row.status,
    ]),
    columnStyles: { 3: { halign: "right" } },
  });
  const total = rows
    .filter((row) => row.status === "pending")
    .reduce((sum, row) => sum + Number(row.amount ?? 0), 0);
  doc.setFontSize(10);
  doc.text(`Outstanding balance: ${formatPeso(total)}`, 14, afterTable(doc) + 2);
  footer(doc, "Settle at any RCC branch desk. Waivers require an Administrator signature.");
  doc.save(`rcc-penalties-${Date.now()}.pdf`);
}
