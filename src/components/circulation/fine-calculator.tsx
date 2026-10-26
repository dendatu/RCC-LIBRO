"use client";

import * as React from "react";
import { Calculator, Loader2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SectionRule } from "@/components/circulation/section-rule";
import { formatDateTime, formatPeso } from "@/lib/utils";
import { previewFineForLoan } from "@/server/actions/circulation";
import type { DeskLoan } from "@/server/data/circulation";

function toInputValue(date: Date) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(
    date.getMinutes(),
  )}`;
}

/**
 * Fine calculator. `calculate_fine()` does the arithmetic — the desk only picks
 * a loan and the moment to charge it up to.
 */
export function FineCalculator({ loans }: { loans: DeskLoan[] }) {
  const [loanId, setLoanId] = React.useState(loans[0]?.id ?? "");
  const [asOf, setAsOf] = React.useState(() => toInputValue(new Date()));
  const [result, setResult] = React.useState<{ fine: number; loan: DeskLoan } | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  const loan = loans.find((row) => row.id === loanId) ?? null;

  const compute = () => {
    if (!loanId) return;
    startTransition(async () => {
      const response = await previewFineForLoan(loanId, asOf ? new Date(asOf).toISOString() : undefined);
      if (response.ok && response.data) {
        setResult(response.data);
        setError(null);
        return;
      }
      setResult(null);
      setError(response.message ?? "The calculator could not read that loan.");
    });
  };

  return (
    <div className="surface-card space-y-4 p-5">
      <div>
        <h2 className="flex items-center gap-2 font-serif text-base text-ink">
          <Calculator className="size-4 text-brand-600" /> Fine calculator
        </h2>
        <p className="mt-1 text-xs text-ink-soft">
          Preview the penalty on an open loan at any moment. Nothing is written until the copy is
          checked in or the overdue job assesses it.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="calc-loan">Open loan</Label>
        <Select
          value={loanId}
          onValueChange={(value) => {
            setLoanId(value);
            setResult(null);
            setError(null);
          }}
        >
          <SelectTrigger id="calc-loan">
            <SelectValue placeholder={loans.length ? "Choose a loan" : "No loan is out on loan"} />
          </SelectTrigger>
          <SelectContent className="max-h-80">
            {loans.map((row) => (
              <SelectItem key={row.id} value={row.id}>
                {row.reference_no} — {row.borrower_name} · {row.book_title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="calc-asof">Charge up to</Label>
        <Input
          id="calc-asof"
          type="datetime-local"
          value={asOf}
          onChange={(event) => setAsOf(event.target.value)}
          className="h-11 font-mono"
        />
        {loan ? (
          <p className="text-[11px] text-muted-foreground">
            Borrowed {formatDateTime(loan.date_borrowed)} · due {formatDateTime(loan.due_date)}
          </p>
        ) : null}
      </div>

      {loan ? <SectionRule section={loan.section} /> : null}

      <Button size="lg" className="w-full" disabled={!loanId || pending} onClick={compute}>
        {pending ? <Loader2 className="size-4 animate-spin" /> : <Calculator className="size-4" />}
        Calculate the fine
      </Button>

      <div aria-live="polite" className="space-y-3">
        {error ? (
          <Alert variant="warning">
            <AlertTitle>No figure</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
        {result ? (
          <div className="rounded-xl border border-border bg-parchment p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-brand-500">Assessed by Postgres</p>
            <p className="mt-1 font-serif text-3xl text-ink">{formatPeso(result.fine)}</p>
            <p className="mt-2 text-xs text-ink-soft">
              {result.loan.borrower_name} — {result.loan.book_title} ({result.loan.reference_no})
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {result.fine > 0
                ? "Reserve titles are charged hourly; every other section is charged per calendar day."
                : "This loan is inside its due date at the moment you chose."}
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
