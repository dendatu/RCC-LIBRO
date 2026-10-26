"use client";

import * as React from "react";
import { Loader2, CalendarPlus } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SectionRule } from "@/components/circulation/section-rule";
import { useFormAction } from "@/hooks/use-form-action";
import { POLICY } from "@/lib/constants";
import { formatDateTime, relativeDue } from "@/lib/utils";
import { extendLoan } from "@/server/actions/circulation";
import type { DeskLoan } from "@/server/data/circulation";

const OPTIONS = [POLICY.loanDays, 14, 30];

/** Desk renewal — `extend_due_date()` decides whether the loan may stretch. */
export function ExtendDialog({
  loan,
  open,
  onOpenChange,
}: {
  loan: DeskLoan | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const action = useFormAction(extendLoan);
  const [days, setDays] = React.useState(String(POLICY.loanDays));

  React.useEffect(() => {
    if (!open) return;
    setDays(String(POLICY.loanDays));
    action.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, loan?.id]);

  React.useEffect(() => {
    if (!action.state) return;
    if (action.state.ok) {
      toast.success(action.state.message ?? "Loan extended.");
      onOpenChange(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [action.state]);

  if (!loan) return null;

  const exhausted = loan.renewals_used >= loan.max_renewals;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Extend {loan.reference_no}</DialogTitle>
          <DialogDescription>
            {loan.book_title} — {loan.borrower_name}. Currently due{" "}
            {formatDateTime(loan.due_date)}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2 text-xs text-ink-soft">
            <span className="rounded-full bg-secondary px-2.5 py-1">
              Renewals used {loan.renewals_used} of {loan.max_renewals}
            </span>
            <span className="rounded-full bg-secondary px-2.5 py-1">{relativeDue(loan.due_date)}</span>
          </div>
          <SectionRule section={loan.section} />

          <div className="space-y-2">
            <Label htmlFor="extend-days">Additional days</Label>
            <Select value={days} onValueChange={setDays}>
              <SelectTrigger id="extend-days">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {OPTIONS.map((option) => (
                  <SelectItem key={option} value={String(option)}>
                    {option} days
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground">
              Postgres recomputes the due date from the section rule and refuses the extension if the
              account is blocked, overdue beyond the limit or the renewals are used up.
            </p>
          </div>

          {action.state && !action.state.ok ? (
            <Alert variant="destructive">
              <AlertTitle>Extension refused</AlertTitle>
              <AlertDescription>{action.state.message}</AlertDescription>
            </Alert>
          ) : null}

          <Button
            size="lg"
            className="w-full"
            disabled={action.pending || exhausted}
            onClick={() => action.submit({ transactionId: loan.id, days })}
          >
            {action.pending ? <Loader2 className="size-4 animate-spin" /> : <CalendarPlus className="size-4" />}
            {exhausted ? "No renewals left on this loan" : "Extend the due date"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
