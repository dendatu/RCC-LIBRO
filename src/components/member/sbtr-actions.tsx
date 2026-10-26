"use client";

import { FileDown, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { downloadSbtr } from "@/lib/pdf";

export interface SbtrHeaderInfo {
  name: string;
  email: string;
  classification: string;
  sbtr?: string | null;
  card?: string | null;
}

export interface SbtrDownloadRow {
  title: string;
  accession_number: string;
  date_borrowed: string;
  due_date: string;
  date_returned: string | null;
  librarian: string;
}

export function SbtrActions({
  info,
  rows,
  showPrint = true,
}: {
  info: SbtrHeaderInfo;
  rows: SbtrDownloadRow[];
  showPrint?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {showPrint ? (
        <Button variant="outline" size="sm" onClick={() => window.print()}>
          <Printer className="size-4" />
          Print SBTR
        </Button>
      ) : null}
      <Button
        variant="gold"
        size="sm"
        onClick={() => downloadSbtr(info, rows)}
        disabled={rows.length === 0}
      >
        <FileDown className="size-4" />
        Download SBTR PDF
      </Button>
    </div>
  );
}
