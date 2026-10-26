"use client";

import * as React from "react";
import { Loader2, RotateCw } from "lucide-react";
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
import { useFormAction } from "@/hooks/use-form-action";
import { extendAction } from "@/server/actions/circulation";
import { POLICY } from "@/lib/constants";

const OPTIONS = [POLICY.loanDays, 14, 30];

/** Desk-only renewal: pushes the due date forward via `extend_due_date()`. */
export function ExtendControl({
  transactionId,
  title,
  renewalsUsed,
  maxRenewals,
}: {
  transactionId: string;
  title: string;
  renewalsUsed: number;
  maxRenewals: number;
}) {
  const [open, setOpen] = React.useState(false);
  const [days, setDays] = React.useState(String(POLICY.loanDays));
  const action = useFormAction(extendAction);

  const exhausted = renewalsUsed >= maxRenewals;

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    action.submit({ transactionId, days });
    if (action.state?.ok !== false) setOpen(false);
  };

  React.useEffect(() => {
    if (action.state?.ok) setOpen(false);
  }, [action.state]);

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        disabled={exhausted}
        title={exhausted ? "Renewal limit reached" : "Extend the due date"}
        onClick={() => {
          setDays(String(POLICY.loanDays));
          action.reset();
          setOpen(true);
        }}
      >
        <RotateCw className="size-3.5" /> Extend
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Extend loan</DialogTitle>
            <DialogDescription>{title}</DialogDescription>
          </DialogHeader>

          <form id="extend-form" onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>New loan period</Label>
              <RadioGroup value={days} onValueChange={setDays} className="grid gap-2 sm:grid-cols-3">
                {OPTIONS.map((option) => (
                  <label
                    key={option}
                    className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-border p-3 text-sm transition-colors hover:border-brand-300 data-[state=checked]:border-brand-400 data-[state=checked]:bg-brand-50"
                  >
                    <RadioGroupItem value={String(option)} />
                    {option} days
                  </label>
                ))}
              </RadioGroup>
            </div>
            <p className="text-xs text-muted-foreground">
              Renewal {renewalsUsed} of {maxRenewals}. The desk may extend once the borrower clears any overdue fines.
            </p>
            {action.state && !action.state.ok && action.state.message ? (
              <p className="text-sm text-danger">{action.state.message}</p>
            ) : null}
          </form>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" form="extend-form" disabled={action.pending}>
              {action.pending ? <Loader2 className="size-4 animate-spin" /> : <RotateCw className="size-4" />}
              Confirm extension
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
