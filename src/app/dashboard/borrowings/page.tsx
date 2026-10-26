import type { Metadata } from "next";
import Link from "next/link";
import { BookOpenCheck, ScanBarcode } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusPill } from "@/components/circulation/status-pill";
import { SectionRule } from "@/components/circulation/section-rule";
import { ExtendControl } from "@/components/circulation/extend-control";
import { requireMember, isStaff } from "@/lib/rbac";
import { openLoanEstimates } from "@/server/data/member";
import { STATUS_TONE, POLICY } from "@/lib/constants";
import { cn, formatDate, formatPeso, relativeDue } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "My borrowings",
  description: "Titles currently checked out to you, with due dates and fines.",
};

export default async function BorrowingsPage() {
  const member = await requireMember();
  const canExtend = isStaff(member);
  const loans = await openLoanEstimates(member.user.id);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="My library"
        title="My borrowings"
        description="Everything checked out under your name, closest due date first."
        actions={
          <Button asChild variant="outline">
            <Link href="/dashboard/catalog">
              <ScanBarcode className="size-4" /> Find a book
            </Link>
          </Button>
        }
      />

      {loans.length === 0 ? (
        <EmptyState
          icon={<BookOpenCheck className="size-7" />}
          title="Nothing checked out"
          description="Browse the catalogue and present your card at the circulation desk to borrow a title."
          action={
            <Button asChild variant="gold">
              <Link href="/dashboard/catalog">Browse the catalogue</Link>
            </Button>
          }
        />
      ) : (
        <div className="space-y-4">
          {loans.map((loan) => {
            const overdue = loan.is_overdue || new Date(loan.due_date).getTime() < Date.now();
            const tone = overdue ? STATUS_TONE.overdue : STATUS_TONE.active;
            return (
              <div
                key={loan.id}
                id={loan.id}
                className="surface-card hover-lift scroll-mt-24 p-5"
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="font-serif text-lg text-ink">{loan.book?.title ?? "Untitled"}</p>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      {loan.book?.author}
                      {loan.book?.accession_number ? ` · accession ${loan.book.accession_number}` : ""}
                      {loan.copy?.barcode ? ` · ${loan.copy.barcode}` : ""}
                    </p>
                    <p className="mt-1 font-mono text-[11px] text-muted-foreground">{loan.reference_no}</p>
                  </div>
                  <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
                    <span className={cn("rounded-full px-3 py-1 text-sm font-medium", tone)}>
                      {relativeDue(loan.due_date)}
                    </span>
                    <StatusPill status={loan.status} />
                  </div>
                </div>

                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <SectionRule section={loan.section} />
                  <dl className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">Borrowed</dt>
                      <dd className="text-ink">{formatDate(loan.date_borrowed)}</dd>
                    </div>
                    <div>
                      <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">Due</dt>
                      <dd className="text-ink">{formatDate(loan.due_date)}</dd>
                    </div>
                    <div>
                      <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">Renewals</dt>
                      <dd className="text-ink">
                        {loan.renewals_used} of {loan.max_renewals}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">Fine accruing</dt>
                      <dd className={loan.estimated > 0 ? "text-danger" : "text-ink"}>
                        {loan.estimated > 0 ? formatPeso(loan.estimated) : "₱0.00"}
                        {loan.estimated > 0 && loan.accruesHourly ? (
                          <span className="text-xs text-muted-foreground"> (₱{POLICY.reserveFinePerHour.toFixed(2)}/hr)</span>
                        ) : null}
                      </dd>
                    </div>
                  </dl>
                </div>

                {canExtend ? (
                  <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-4">
                    <Badge variant="secondary">Desk action</Badge>
                    <ExtendControl
                      transactionId={loan.id}
                      title={loan.book?.title ?? "this loan"}
                      renewalsUsed={loan.renewals_used}
                      maxRenewals={loan.max_renewals}
                    />
                    <span className="text-xs text-muted-foreground">
                      Extensions are a staff action — the borrower&rsquo;s copy shows the due date only.
                    </span>
                  </div>
                ) : (
                  loan.renewals_used >= loan.max_renewals ? (
                    <p className="mt-3 text-xs text-muted-foreground">
                      Renewal limit reached — return the copy at the desk to borrow it again.
                    </p>
                  ) : (
                    <p className="mt-3 text-xs text-muted-foreground">
                      Ask the circulation desk to extend this loan if you need more time.
                    </p>
                  )
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
