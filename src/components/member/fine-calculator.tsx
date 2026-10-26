"use client";

import { useState } from "react";
import { Calculator, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { SECTION_META } from "@/lib/constants";
import { formatDate, formatPeso } from "@/lib/utils";
import { requestFineEstimate } from "@/server/actions/member";
import type { CirculationSection } from "@/lib/types";

export interface EstimatableLoan {
  id: string;
  reference_no: string;
  title: string;
  section: CirculationSection;
  due_date: string;
  estimated: number;
  accruesHourly: boolean;
}

export function FineCalculator({ loans }: { loans: EstimatableLoan[] }) {
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [estimates, setEstimates] = useState<Record<string, number>>({});

  const refresh = async (loan: EstimatableLoan) => {
    setPendingId(loan.id);
    try {
      const result = await requestFineEstimate({ transactionId: loan.id });
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      setEstimates((current) => ({ ...current, [loan.id]: result.amount }));
      toast.success(result.message);
    } finally {
      setPendingId(null);
    }
  };

  if (loans.length === 0) {
    return (
      <div className="flex items-start gap-3 rounded-lg bg-muted/60 p-4">
        <Calculator className="mt-0.5 size-4 text-brand-600" />
        <div>
          <p className="text-sm font-medium text-ink">Nothing to estimate</p>
          <p className="mt-1 text-xs text-muted-foreground">
            The calculator runs on your open loans only. Return a book and the desk fixes the final
            figure at check-in.
          </p>
        </div>
      </div>
    );
  }

  return (
    <ul className="divide-y divide-border">
      {loans.map((loan) => {
        const amount = estimates[loan.id] ?? loan.estimated;
        const rule = SECTION_META[loan.section]?.rule ?? "";
        return (
          <li key={loan.id} className="flex flex-wrap items-center gap-3 py-3 first:pt-0 last:pb-0">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-ink">{loan.title}</p>
              <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] text-muted-foreground">
                <span className="font-mono">{loan.reference_no}</span>
                <span>Due {formatDate(loan.due_date)}</span>
                <span>
                  {loan.accruesHourly
                    ? "Reserve rule · PHP 2.00 per overdue hour"
                    : "Standard rule · PHP 1.00 per overdue day"}
                </span>
                {rule ? <span className="hidden sm:inline">· {rule}</span> : null}
              </p>
            </div>
            <p className="font-serif text-lg tabular-nums text-ink">{formatPeso(amount)}</p>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void refresh(loan)}
              disabled={pendingId === loan.id}
              aria-label={`Recalculate the accrued fine for ${loan.title}`}
            >
              {pendingId === loan.id ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <RefreshCw className="size-4" />
              )}
              Recalculate
            </Button>
          </li>
        );
      })}
    </ul>
  );
}
