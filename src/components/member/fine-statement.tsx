"use client";

import { FileDown, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { downloadFineStatement } from "@/lib/pdf";
import type { SbtrHeaderInfo } from "@/components/member/sbtr-actions";

export interface StatementRow {
  type: string;
  book: string;
  amount: number;
  status: string;
  created: string;
}

export function FineStatementActions({
  info,
  rows,
}: {
  info: SbtrHeaderInfo;
  rows: StatementRow[];
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="outline" size="sm" onClick={() => window.print()}>
        <Printer className="size-4" />
        Print statement
      </Button>
      <Button
        variant="gold"
        size="sm"
        onClick={() => downloadFineStatement(info, rows)}
        disabled={rows.length === 0}
      >
        <FileDown className="size-4" />
        Statement PDF
      </Button>
    </div>
  );
}
