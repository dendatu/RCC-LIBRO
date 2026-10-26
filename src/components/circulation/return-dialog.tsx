"use client";

import * as React from "react";
import { Loader2, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { SectionRule } from "@/components/circulation/section-rule";
import { Textarea } from "@/components/ui/textarea";
import { COPY_STATUS_LABEL, SECTION_META } from "@/lib/constants";
import { formatDateTime, formatPeso, relativeDue } from "@/lib/utils";
import type { ActionResult, ReturnCondition } from "@/lib/types";
import { checkInBook, previewFineForLoan, type ReturnOutcome } from "@/server/actions/circulation";
import type { DeskLoan } from "@/server/data/circulation";

const CONDITIONS: { value: ReturnCondition; label: string; hint: string }[] = [
  {
    value: "good",
    label: "Good condition",
    hint: "Copy goes back on the shelf as available.",
  },
  {
    value: "damaged",
    label: "Damaged",
    hint: "Copy is marked damaged and a repair penalty is raised against the borrower.",
  },
  {
    value: "lost",
    label: "Lost",
    hint: "Copy is marked lost and the replacement penalty is raised against the borrower.",
  },
];

/** Check-in dialog. The condition drives which workflow `return_book()` runs. */
export function ReturnDialog({
  loan,
  open,
  onOpenChange,
}: {
  loan: DeskLoan | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [condition, setCondition] = React.useState<ReturnCondition>("good");
  const [remarks, setRemarks] = React.useState("");
  const [state, setState] = React.useState<ActionResult<ReturnOutcome> | null>(null);
  const [estimate, setEstimate] = React.useState<number | null>(null);
  const [pending, startTransition] = React.useTransition();

  React.useEffect(() => {
    if (!open || !loan) {
      setEstimate(null);
      return;
    }
    let cancelled = false;
    setCondition("good");
    setRemarks("");
    setState(null);
    (async () => {
      const result = await previewFineForLoan(loan.id);
      if (!cancelled && result.ok && result.data) setEstimate(result.data.fine);
    })();
    return () => {
      cancelled = true;
    };
  }, [loan, open]);

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!loan) return;
    if (condition !== "good" && remarks.trim().length < 3) {
      setState({ ok: false, message: "Describe the damage or the loss before closing this loan." });
      return;
    }

    const form = new FormData();
    form.append("transactionId", loan.id);
    form.append("condition", condition);
    if (remarks.trim()) form.append("remarks", remarks.trim());

    startTransition(async () => {
      const result = await checkInBook(state, form);
      setState(result);
      if (result.ok) {
        toast.success(result.message ?? "Book checked in.");
        setEstimate(null);
      }
    });
  };

  const outcome = state?.ok ? state.data : undefined;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Check in {loan?.reference_no ?? "a loan"}</DialogTitle>
          <DialogDescription>
            {loan
              ? `${loan.book_title} — ${loan.borrower_name}, due ${formatDateTime(loan.due_date)}.`
              : "Select a loan from the ledger."}
          </DialogDescription>
        </DialogHeader>

        {loan ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-border bg-parchment p-4 text-sm">
              <p className="font-serif text-base text-ink">{loan.book_title}</p>
              <p className="mt-0.5 text-xs text-ink-soft">
                {loan.book_author} · accession {loan.accession_number} ·{" "}
                <span className="font-mono">{loan.barcode ?? "—"}</span>
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-ink-soft">
                <span>{loan.classification}</span>
                {loan.sbtr_number ? <span>SBTR {loan.sbtr_number}</span> : null}
                <span>{loan.library_name}</span>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="text-xs text-muted-foreground">{relativeDue(loan.due_date)}</span>
                <span className="text-xs text-muted-foreground">
                  Fine if returned now:{" "}
                  <span className="font-semibold text-ink">
                    {estimate === null ? "…" : formatPeso(estimate)}
                  </span>
                </span>
              </div>
              <SectionRule section={loan.section} className="mt-3" />
            </div>

            <form onSubmit={submit} className="space-y-4">
              <fieldset className="space-y-2">
                <legend className="text-sm font-semibold text-ink">Condition of the copy</legend>
                <RadioGroup
                  value={condition}
                  onValueChange={(value) => setCondition(value as ReturnCondition)}
                  className="gap-2"
                >
                  {CONDITIONS.map((option) => (
                    <label
                      key={option.value}
                      className="flex min-h-14 cursor-pointer items-start gap-3 rounded-xl border border-border bg-card p-3 transition-colors hover:border-brand-300 has-[:checked]:border-brand-500 has-[:checked]:bg-brand-50"
                    >
                      <RadioGroupItem value={option.value} className="mt-1" />
                      <span>
                        <span className="block text-sm font-semibold text-ink">{option.label}</span>
                        <span className="mt-0.5 block text-xs text-ink-soft">{option.hint}</span>
                      </span>
                    </label>
                  ))}
                </RadioGroup>
              </fieldset>

              <div className="space-y-2">
                <Label htmlFor="return-remarks">Desk remark</Label>
                <Textarea
                  id="return-remarks"
                  rows={3}
                  maxLength={500}
                  value={remarks}
                  onChange={(event) => setRemarks(event.target.value)}
                  placeholder={
                    condition === "good"
                      ? "Optional — note anything the next borrower should know"
                      : "Required — describe the damage or how the copy was lost"
                  }
                />
              </div>

              <div aria-live="polite" className="space-y-3">
                {state && !state.ok ? (
                  <Alert variant="destructive">
                    <AlertTitle>Check-in not completed</AlertTitle>
                    <AlertDescription>{state.message}</AlertDescription>
                  </Alert>
                ) : null}

                {outcome ? (
                  <Alert variant={outcome.fine > 0 || outcome.condition !== "good" ? "warning" : "default"}>
                    <AlertTitle>
                      {outcome.condition === "good" ? "Checked in" : `Recorded as ${outcome.condition}`}
                    </AlertTitle>
                    <AlertDescription>
                      <p>{state?.message}</p>
                      <dl className="mt-2 grid gap-1 text-xs sm:grid-cols-2">
                        <div className="flex justify-between gap-2">
                          <dt className="text-muted-foreground">Fine assessed</dt>
                          <dd className="font-semibold text-ink">{formatPeso(outcome.fine)}</dd>
                        </div>
                        <div className="flex justify-between gap-2">
                          <dt className="text-muted-foreground">Copy status</dt>
                          <dd className="font-semibold text-ink">
                            {COPY_STATUS_LABEL[outcome.copyStatus as keyof typeof COPY_STATUS_LABEL] ??
                              outcome.copyStatus}
                          </dd>
                        </div>
                        {outcome.overdueDays > 0 ? (
                          <div className="flex justify-between gap-2">
                            <dt className="text-muted-foreground">Days overdue</dt>
                            <dd className="font-semibold text-ink">{outcome.overdueDays}</dd>
                          </div>
                        ) : null}
                        {outcome.overdueHours > 0 ? (
                          <div className="flex justify-between gap-2">
                            <dt className="text-muted-foreground">Hours overdue</dt>
                            <dd className="font-semibold text-ink">{outcome.overdueHours}</dd>
                          </div>
                        ) : null}
                      </dl>
                      <p className="mt-2 text-xs text-muted-foreground">
                        Settle any penalty at the fine desk before the borrower takes another title.
                      </p>
                    </AlertDescription>
                  </Alert>
                ) : null}
              </div>

              {outcome ? (
                <Button type="button" size="lg" className="w-full" onClick={() => onOpenChange(false)}>
                  Close and return to the ledger
                </Button>
              ) : (
                <Button type="submit" size="lg" className="w-full" disabled={pending}>
                  {pending ? <Loader2 className="size-4 animate-spin" /> : <Undo2 className="size-4" />}
                  Check in this copy
                </Button>
              )}
            </form>
          </div>
        ) : null}

        <DialogFooter>
          <p className="text-xs text-muted-foreground">
            {loan ? SECTION_META[loan.section]?.rule : ""}
          </p>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
