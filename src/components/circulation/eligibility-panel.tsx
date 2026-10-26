"use client";

import * as React from "react";
import { CircleCheckBig, TriangleAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { checkEligibility } from "@/server/actions/circulation";
import { formatPeso } from "@/lib/utils";
import type { EligibilityResult } from "@/server/data/circulation";

/**
 * Live eligibility read from `evaluate_borrow_eligibility`. The desk never
 * decides policy in the browser — this panel only mirrors what Postgres says.
 */
export function EligibilityPanel({
  borrowerId,
  borrowerName,
}: {
  borrowerId: string | null;
  borrowerName?: string;
}) {
  const [state, setState] = React.useState<EligibilityResult | null>(null);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const requestId = React.useRef(0);

  React.useEffect(() => {
    const id = requestId.current + 1;
    requestId.current = id;
    setState(null);
    setError(null);
    if (!borrowerId) return;

    let cancelled = false;
    (async () => {
      setPending(true);
      const result = await checkEligibility(borrowerId);
      if (cancelled || requestId.current !== id) return;
      setPending(false);
      if (result.ok && result.data) setState(result.data);
      else setError(result.message ?? "Eligibility could not be checked.");
    })();

    return () => {
      cancelled = true;
    };
  }, [borrowerId]);

  if (!borrowerId) {
    return (
      <div className="rounded-xl border border-dashed border-brand-200 bg-parchment p-4 text-sm text-muted-foreground">
        Select a borrower to run the eligibility check.
      </div>
    );
  }

  if (pending) {
    return (
      <div className="space-y-3 rounded-xl border border-border bg-card p-4">
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-2 w-full" />
        <Skeleton className="h-4 w-2/3" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <TriangleAlert className="size-4" />
        <AlertTitle>Eligibility check failed</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (!state) return null;

  const limit = Math.max(1, state.borrowing_limit);
  const used = Math.min(state.active_loans, limit);

  return (
    <div aria-live="polite" className="space-y-4 rounded-xl border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            Eligibility
          </p>
          <p className="truncate font-serif text-base text-ink">{borrowerName ?? "Borrower"}</p>
        </div>
        {state.eligible ? (
          <Badge variant="success">
            <CircleCheckBig className="size-3" /> Cleared to borrow
          </Badge>
        ) : (
          <Badge variant="destructive">
            <TriangleAlert className="size-3" /> Held
          </Badge>
        )}
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Books out</span>
          <span className="tabular-nums">
            {state.active_loans} of {state.borrowing_limit}
          </span>
        </div>
        <Progress value={(used / limit) * 100} indicatorClassName={state.eligible ? "bg-success" : "bg-destructive"} />
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs">
        <Badge variant="secondary">{formatPeso(state.outstanding_fines)} unsettled fines</Badge>
        <Badge variant="outline">Limit {state.borrowing_limit} titles</Badge>
      </div>

      {state.reasons.length > 0 ? (
        <ul className="space-y-2 rounded-lg bg-destructive/10 p-3 text-xs text-destructive">
          {state.reasons.map((reason) => (
            <li key={reason.code} className="flex gap-2">
              <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              <span>{reason.message}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="flex items-center gap-2 text-xs text-success">
          <CircleCheckBig className="size-3.5" aria-hidden />
          No blocking condition on this account.
        </p>
      )}
    </div>
  );
}
