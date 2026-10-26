"use client";

import * as React from "react";
import { Loader2, RefreshCcw, Search } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LoanTable } from "@/components/circulation/loan-table";
import { ReturnDialog } from "@/components/circulation/return-dialog";
import { ExtendDialog } from "@/components/circulation/extend-dialog";
import { useFormAction } from "@/hooks/use-form-action";
import { searchDeskLoans, sweepOverdue } from "@/server/actions/circulation";
import type { DeskLoan } from "@/server/data/circulation";

function isSameDay(value: string) {
  const date = new Date(value);
  const now = new Date();
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
}

/**
 * Return desk. Scan a label or type a reference to pull the open loans for that
 * copy, then check in — the fine is whatever `return_book()` assesses.
 */
export function ReturnDesk({
  loans,
  lostAndDamaged,
  initialTerm = "",
}: {
  loans: DeskLoan[];
  lostAndDamaged: React.ReactNode;
  initialTerm?: string;
}) {
  const [term, setTerm] = React.useState(initialTerm);
  const [results, setResults] = React.useState<DeskLoan[] | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [searching, setSearching] = React.useState(false);
  const [returning, setReturning] = React.useState<DeskLoan | null>(null);
  const [extending, setExtending] = React.useState<DeskLoan | null>(null);
  const requestId = React.useRef(0);
  const sweep = useFormAction(sweepOverdue);

  React.useEffect(() => {
    if (sweep.state?.ok) toast.success(sweep.state.message ?? "Overdue check complete.");
  }, [sweep.state]);

  const runSearch = React.useCallback(async (value: string) => {
    const clean = value.trim();
    const id = ++requestId.current;
    if (clean.length < 2) {
      setResults(null);
      setNotice(null);
      setSearching(false);
      return;
    }
    setSearching(true);
    const result = await searchDeskLoans(clean);
    if (id !== requestId.current) return;
    setSearching(false);
    setNotice(result.message ?? null);
    setResults(result.ok && result.data ? result.data : []);
  }, []);

  React.useEffect(() => {
    if (!term.trim()) {
      setResults(null);
      setNotice(null);
      return;
    }
    const timer = window.setTimeout(() => void runSearch(term), 320);
    return () => window.clearTimeout(timer);
  }, [term, runSearch]);

  const ledger = results ?? loans;
  const dueToday = ledger.filter((loan) => isSameDay(loan.due_date));
  const overdue = ledger.filter((loan) => loan.status === "overdue" || loan.is_overdue || loan.days_left < 0);
  const current = ledger.filter((loan) => loan.status === "active" && loan.days_left >= 0);

  return (
    <div className="space-y-5">
      <div className="surface-card space-y-3 p-4 sm:p-5">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void runSearch(term);
              }
            }}
            aria-label="Scan a copy label or type a reference number"
            placeholder="Scan a copy label, or type a reference number, barcode or borrower name"
            className="h-14 rounded-xl pl-11 font-mono text-base"
          />
          {term ? (
            <button
              type="button"
              onClick={() => {
                setTerm("");
                setResults(null);
                setNotice(null);
              }}
              className="absolute top-1/2 right-3 -translate-y-1/2 rounded-lg px-2 py-1 text-xs text-muted-foreground hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
            >
              Clear
            </button>
          ) : null}
          {searching ? (
            <span className="absolute top-full mt-1 flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin" /> Matching the ledger…
            </span>
          ) : null}
        </div>

        <div aria-live="polite" className="space-y-2">
          {notice ? (
            <Alert variant={results && results.length ? "info" : "warning"}>
              <AlertDescription>{notice}</AlertDescription>
            </Alert>
          ) : null}
          <p className="text-xs text-muted-foreground">
            {results
              ? `${results.length} open loan(s) match “${term.trim()}”.`
              : `${overdue.length} overdue, ${dueToday.length} due today, ${current.length} still inside the loan period.`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 border-t border-border pt-3">
          <Button size="sm" variant="outline" disabled={sweep.pending} onClick={() => sweep.submit({})}>
            {sweep.pending ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCcw className="size-3.5" />}
            Run the overdue check
          </Button>
          <p className="text-[11px] text-muted-foreground">
            {sweep.state?.message ??
              "Marks loans past their due date overdue and posts the daily fine — both done by Postgres."}
          </p>
        </div>
      </div>

      <Tabs defaultValue="today">
        <TabsList className="w-full sm:w-fit">
          <TabsTrigger value="today">
            Due today
            <Badge variant={dueToday.length ? "warning" : "secondary"}>{dueToday.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="overdue">
            Overdue
            <Badge variant={overdue.length ? "destructive" : "secondary"}>{overdue.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="open">
            All open
            <Badge variant="secondary">{ledger.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="lost">
            Lost &amp; damaged
            <Badge variant="secondary">Register</Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="today">
          <LoanTable
            loans={dueToday}
            onReturn={setReturning}
            onExtend={setExtending}
            emptyTitle="Nothing falls due today"
            emptyDescription="Books due on this date appear here. Scan a label to check one in early."
          />
        </TabsContent>

        <TabsContent value="overdue">
          <LoanTable
            loans={overdue}
            onReturn={setReturning}
            onExtend={setExtending}
            emptyTitle="No overdue loans"
            emptyDescription="Every loan on the ledger is inside its due date."
          />
        </TabsContent>

        <TabsContent value="open">
          <LoanTable
            loans={ledger}
            onReturn={setReturning}
            onExtend={setExtending}
            emptyTitle={results ? "No loan matches that scan" : "The ledger is empty"}
            emptyDescription={
              results
                ? "Check the label against the accession register, or search by borrower name."
                : "Nothing is out on loan right now."
            }
          />
        </TabsContent>

        <TabsContent value="lost">{lostAndDamaged}</TabsContent>
      </Tabs>

      <ReturnDialog
        loan={returning}
        open={Boolean(returning)}
        onOpenChange={(next) => !next && setReturning(null)}
      />
      <ExtendDialog
        loan={extending}
        open={Boolean(extending)}
        onOpenChange={(next) => !next && setExtending(null)}
      />
    </div>
  );
}
