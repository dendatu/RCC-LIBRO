"use client";

import { FileDown } from "lucide-react";
import type * as React from "react";
import { Button } from "@/components/ui/button";
import {
  downloadBorrowingHistory,
  downloadFineStatement,
  downloadSbtr,
} from "@/lib/pdf";

export interface PdfHeaderInfo {
  name: string;
  email: string;
  classification: string;
  sbtr?: string | null;
  card?: string | null;
}

type HistoryRow = {
  reference_no: string;
  title: string;
  accession_number: string;
  date_borrowed: string;
  due_date: string;
  date_returned: string | null;
  status: string;
  fine: number;
};

type SbtrPdfRow = {
  title: string;
  accession_number: string;
  date_borrowed: string;
  due_date: string;
  date_returned: string | null;
  librarian: string;
};

type FinePdfRow = { type: string; book: string; amount: number; status: string; created: string };

type ButtonProps = React.ComponentProps<typeof Button>;

function BaseButton({ children, ...props }: ButtonProps) {
  return (
    <Button variant="gold" {...props}>
      <FileDown className="size-4" />
      {children}
    </Button>
  );
}

export function HistoryPdfButton({
  info,
  rows,
}: {
  info: PdfHeaderInfo;
  rows: HistoryRow[];
}) {
  return (
    <BaseButton type="button" onClick={() => downloadBorrowingHistory(info, rows)}>
      Download history
    </BaseButton>
  );
}

export function SbtrPdfButton({ info, rows }: { info: PdfHeaderInfo; rows: SbtrPdfRow[] }) {
  return (
    <BaseButton type="button" onClick={() => downloadSbtr(info, rows)}>
      Download SBTR
    </BaseButton>
  );
}

export function PenaltyPdfButton({ info, rows }: { info: PdfHeaderInfo; rows: FinePdfRow[] }) {
  return (
    <BaseButton type="button" onClick={() => downloadFineStatement(info, rows)}>
      Download statement
    </BaseButton>
  );
}
