"use client";

import * as React from "react";
import { Loader2, ScanBarcode, TriangleAlert } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { BarcodeField } from "@/components/circulation/barcode-field";
import { BorrowerSearch } from "@/components/circulation/borrower-search";
import { EligibilityPanel } from "@/components/circulation/eligibility-panel";
import { ReceiptCard } from "@/components/circulation/receipt-card";
import { SectionRule } from "@/components/circulation/section-rule";
import { issueBook, refreshDuePreview, type BorrowReceipt, type CopyLookup } from "@/server/actions/circulation";
import { COPY_STATUS_LABEL, POLICY } from "@/lib/constants";
import { formatDateTime } from "@/lib/utils";
import type { ActionResult, CirculationSection } from "@/lib/types";
import type { BorrowerOption, DeskCopy } from "@/server/data/circulation";

/**
 * Issue-books desk. The copy is resolved and the due date previewed by
 * Postgres; the loan itself is recorded by the `borrow_book` RPC, which returns
 * the policy message the desk shows to staff.
 */
export function IssueDesk({
  initialBarcode = "",
  initialCopy = null,
  initialBorrower = null,
  autoFocusBarcode = false,
}: {
  initialBarcode?: string;
  initialCopy?: CopyLookup | null;
  initialBorrower?: BorrowerOption | null;
  autoFocusBarcode?: boolean;
}) {
  const [lookup, setLookup] = React.useState<CopyLookup | null>(initialCopy);
  const [borrower, setBorrower] = React.useState<BorrowerOption | null>(initialBorrower);
  const [days, setDays] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [state, setState] = React.useState<ActionResult<BorrowReceipt> | null>(null);
  const [receipt, setReceipt] = React.useState<BorrowReceipt | null>(null);
  const [appliedOverride, setAppliedOverride] = React.useState<number | null>(null);
  const [pending, startTransition] = React.useTransition();

  const dueDate = lookup?.dueDate ?? null;
  const override = days.trim() ? Number(days) : null;
  const overrideUsable =
    override === null || (Number.isInteger(override) && override >= 1 && override <= 60);

  React.useEffect(() => {
    if (!lookup || !overrideUsable || override === appliedOverride) return;

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      const result = await refreshDuePreview(lookup.copy.section, override);
      if (cancelled || !result.ok || !result.data) return;
      const next = result.data.dueDate;
      setAppliedOverride(override);
      setLookup((current) => (current ? { ...current, dueDate: next } : current));
    }, 320);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [appliedOverride, lookup, override, overrideUsable]);

  const onCopyResolved = (result: CopyLookup | null) => {
    setLookup(result);
    setAppliedOverride(null);
    setState(null);
  };

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!borrower || !lookup) return;
    const form = new FormData();
    form.append("borrowerId", borrower.user_id);
    form.append("barcode", lookup.copy.barcode);
    if (days.trim()) form.append("days", days.trim());
    if (notes.trim()) form.append("notes", notes.trim());

    startTransition(async () => {
      const result = await issueBook(state, form);
      setState(result);
      if (result.ok && result.data) setReceipt(result.data);
    });
  };

  const startOver = () => {
    setReceipt(null);
    setState(null);
    setLookup(null);
    setNotes("");
    setDays("");
  };

  if (receipt) {
    return (
      <div className="grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <ReceiptCard receipt={receipt} onBorrowAnother={startOver} />
        </div>
        <aside className="space-y-4 lg:col-span-2">
          <div className="surface-card p-5">
            <h2 className="font-serif text-base text-ink">Next at the desk</h2>
            <p className="mt-2 text-sm text-ink-soft">
              Scan another copy for the same borrower, or clear the desk for the next member.
            </p>
            <Button variant="secondary" className="mt-3 w-full" onClick={startOver}>
              <ScanBarcode className="size-4" /> Clear the desk
            </Button>
          </div>
        </aside>
      </div>
    );
  }

  const copy: DeskCopy | null = lookup?.copy ?? null;
  const blockedByCopy =
    copy && copy.status !== "available"
      ? `This copy is ${COPY_STATUS_LABEL[copy.status]?.toLowerCase() ?? copy.status}.`
      : copy && (copy.is_library_use_only || !SECTION_META_BORROWABLE(copy.section))
        ? "This title is for library use only and cannot leave the library."
        : null;

  const canIssue = Boolean(borrower && copy && !blockedByCopy && !pending);

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      <div className="space-y-5 lg:col-span-3">
        <form onSubmit={submit} className="surface-card space-y-5 p-5 sm:p-6">
          <BarcodeField
            initial={initialBarcode}
            autoFocus={autoFocusBarcode}
            onResolve={onCopyResolved}
          />

          {copy ? (
            <div className="space-y-3 rounded-xl border border-border bg-parchment p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-serif text-base text-ink">{copy.title}</p>
                  <p className="mt-0.5 truncate text-xs text-ink-soft">
                    {copy.author} · accession {copy.book_accession} · {copy.library_name}
                  </p>
                </div>
                <Badge variant={copy.status === "available" ? "success" : "warning"}>
                  {COPY_STATUS_LABEL[copy.status] ?? copy.status}
                </Badge>
              </div>
              <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                <span className="font-mono">{copy.barcode}</span>
                <span>· copy {copy.copy_number} of {copy.total_copies}</span>
                {copy.shelf_location ? <span>· shelf {copy.shelf_location}</span> : null}
                <span>· {copy.available_copies} available</span>
              </div>
              <SectionRule section={copy.section} />
              {dueDate ? (
                <p className="text-xs text-ink-soft">
                  If issued now it is due{" "}
                  <span className="font-semibold text-ink">{formatDateTime(dueDate)}</span>.
                </p>
              ) : null}
              {blockedByCopy ? (
                <Alert variant="warning">
                  <AlertTitle>Cannot be issued</AlertTitle>
                  <AlertDescription>{blockedByCopy}</AlertDescription>
                </Alert>
              ) : null}
            </div>
          ) : null}

          <BorrowerSearch initial={initialBorrower} onSelect={setBorrower} />

          <div className="grid gap-4 sm:grid-cols-[9rem_1fr]">
            <div className="space-y-2">
              <Label htmlFor="desk-days" className="text-sm font-semibold text-ink">
                Loan days
              </Label>
              <Input
                id="desk-days"
                type="number"
                min={1}
                max={60}
                inputMode="numeric"
                value={days}
                onChange={(event) => setDays(event.target.value)}
                placeholder={`Default ${POLICY.loanDays}`}
              />
              <p className="text-[11px] text-muted-foreground">
                Leave blank to use the section rule. Reserve books ignore the override.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="desk-notes" className="text-sm font-semibold text-ink">
                Desk note
              </Label>
              <Textarea
                id="desk-notes"
                rows={3}
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Optional remark recorded on the transaction"
                maxLength={500}
              />
            </div>
          </div>

          {state && !state.ok ? (
            <Alert variant="destructive">
              <TriangleAlert className="size-4" />
              <AlertTitle>The loan was not recorded</AlertTitle>
              <AlertDescription>
                <p>{state.message}</p>
                {state.errors?.eligibility?.length ? (
                  <ul className="mt-2 list-disc space-y-1 pl-4">
                    {state.errors.eligibility.map((reason) => (
                      <li key={reason}>{reason}</li>
                    ))}
                  </ul>
                ) : null}
              </AlertDescription>
            </Alert>
          ) : null}

          <Button type="submit" size="lg" className="w-full" disabled={!canIssue}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : <ScanBarcode className="size-4" />}
            Issue book
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            {borrower
              ? `Issuing to ${borrower.full_name}. Postgres decides eligibility, the due date and any fine.`
              : "Choose a borrower before issuing."}
          </p>
        </form>
      </div>

      <div className="space-y-5 lg:col-span-2">
        <EligibilityPanel borrowerId={borrower?.user_id ?? null} borrowerName={borrower?.full_name} />
        <div className="surface-card p-5">
          <h2 className="mb-3 font-serif text-base text-ink">Desk reminders</h2>
          <ul className="space-y-2 text-sm text-ink-soft">
            {[
              `A student needs an active SBTR before any loan is released; faculty borrow against their department ID.`,
              `${POLICY.maxBooks} titles for ${POLICY.loanDays} days, weekends and holidays included.`,
              `Overdue books accrue PHP ${POLICY.finePerDay.toFixed(2)} per day; reserve books PHP ${POLICY.reserveFinePerHour.toFixed(2)} per hour.`,
              "Reference and periodicals never leave the library.",
            ].map((line) => (
              <li key={line} className="flex gap-2">
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-gold" />
                {line}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function SECTION_META_BORROWABLE(section: CirculationSection) {
  return section !== "reference" && section !== "periodicals";
}
