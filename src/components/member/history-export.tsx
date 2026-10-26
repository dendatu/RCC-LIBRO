"use client";

import Link from "next/link";
import { FileDown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { downloadBorrowingHistory } from "@/lib/pdf";
import type { SbtrHeaderInfo } from "@/components/member/sbtr-actions";

export interface HistoryDownloadRow {
  reference_no: string;
  title: string;
  accession_number: string;
  date_borrowed: string;
  due_date: string;
  date_returned: string | null;
  status: string;
  fine: number;
}

export function HistoryExportButton({
  info,
  rows,
}: {
  info: SbtrHeaderInfo;
  rows: HistoryDownloadRow[];
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        variant="gold"
        size="sm"
        onClick={() => downloadBorrowingHistory(info, rows)}
        disabled={rows.length === 0}
      >
        {rows.length === 0 ? <Loader2 className="size-4" /> : <FileDown className="size-4" />}
        Download borrowing history PDF
      </Button>
      <Button asChild variant="outline" size="sm">
        <Link href="/dashboard/sbtr">View my SBTR</Link>
      </Button>
    </div>
  );
}
