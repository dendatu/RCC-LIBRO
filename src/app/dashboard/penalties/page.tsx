import type { Metadata } from "next";
import Link from "next/link";
import {
  BanknoteIcon,
  Calculator,
  CircleDollarSign,
  Info,
  Landmark,
  QrCode,
  ShieldAlert,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatTile } from "@/components/ui/stat-tile";
import { PageHeader } from "@/components/shell/page-header";
import { StatusPill } from "@/components/member/status-pill";
import { FineCalculator, type EstimatableLoan } from "@/components/member/fine-calculator";
import { FineStatementActions } from "@/components/member/fine-statement";
import { requireMember } from "@/lib/rbac";
import { memberFines, openLoanEstimates } from "@/server/data/member";
import { POLICY, classificationLabel } from "@/lib/constants";
import { formatDate, formatPeso } from "@/lib/utils";
import { borrowerCardUrl, qrDataUrl } from "@/lib/qr";
import type { Fine, FineType } from "@/lib/types";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "My penalties | RCC LIBRO",
  description: "Penalties on your account, how each one was computed, and how to settle it at the desk.",
};

const FINE_LABEL: Record<FineType, string> = {
  overdue_daily: "Overdue book",
  reserve_hourly: "Overdue reserve book",
  lost_book: "Lost copy",
  damaged_book: "Damaged copy",
  manual: "Desk assessment",
};

const FINE_RULE: Record<FineType, string> = {
  overdue_daily: `Standard rule · PHP ${POLICY.finePerDay.toFixed(2)} for every calendar day past the due date, weekends and holidays included.`,
  reserve_hourly: `Reserve rule · PHP ${POLICY.reserveFinePerHour.toFixed(2)} for every hour past the expiry of the borrowing period.`,
  lost_book:
    "Replacement rule · the acquisition price of the copy plus a processing fee, set when the copy is declared lost.",
  damaged_book:
    "Repair rule · a share of the copy's acquisition price, assessed by the librarian at check-in.",
  manual: "Recorded directly by the circulation desk.",
};

function settleDate(fine: Fine): string | null {
  if (fine.status === "paid") return fine.paid_at;
  if (fine.status === "waived") return fine.created_at;
  return null;
}

export default async function PenaltiesPage() {
  const member = await requireMember();
  const [fines, estimates] = await Promise.all([
    memberFines(member.user.id),
    openLoanEstimates(member.user.id),
  ]);

  const pending = fines.filter((fine) => fine.status === "pending");
  const disputed = fines.filter((fine) => fine.status === "disputed");
  const paid = fines.filter((fine) => fine.status === "paid");
  const waived = fines.filter((fine) => fine.status === "waived");

  const outstanding = pending.reduce((sum, fine) => sum + Number(fine.amount ?? 0), 0);
  const accruing = estimates.reduce((sum, loan) => sum + loan.estimated, 0);

  const calculatorLoans: EstimatableLoan[] = estimates.map((loan) => ({
    id: loan.id,
    reference_no: loan.reference_no,
    title: loan.book?.title ?? "Title withheld from this loan",
    section: loan.section,
    due_date: loan.due_date,
    estimated: loan.estimated,
    accruesHourly: loan.accruesHourly,
  }));

  const info = {
    name: member.user.full_name,
    email: member.user.email,
    classification: classificationLabel(member.profile ?? {}),
    sbtr: member.profile?.sbtr_number ?? null,
    card: member.profile?.card_number ?? null,
  };

  const statementRows = fines.map((fine) => ({
    type: FINE_LABEL[fine.type] ?? FINE_LABEL.manual,
    book: fine.book_title ?? "Account penalty",
    amount: Number(fine.amount ?? 0),
    status: fine.status,
    created: fine.created_at,
  }));

  const cardNumber = member.profile?.card_number ?? null;
  const deskQr = cardNumber ? await qrDataUrl(borrowerCardUrl(cardNumber), 192) : null;

  const group = (rows: Fine[], emptyTitle: string, emptyBody: string) =>
    rows.length === 0 ? (
      <EmptyState
        icon={<CircleDollarSign className="size-6" />}
        title={emptyTitle}
        description={emptyBody}
      />
    ) : (
      <ul className="space-y-3">
        {rows.map((fine) => (
          <li key={fine.id} id={fine.id} className="surface-card hover-lift p-4 sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-serif text-base text-ink">{FINE_LABEL[fine.type] ?? "Penalty"}</p>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {fine.book_title ?? "Account penalty"} · assessed {formatDate(fine.created_at)}
                </p>
              </div>
              <div className="text-right">
                <p className="font-serif text-xl tabular-nums text-ink">{formatPeso(fine.amount)}</p>
                <p className="mt-1">
                  <StatusPill status={fine.status} />
                </p>
              </div>
            </div>

            <p className="mt-3 rounded-lg bg-muted/70 px-3 py-2 text-xs leading-relaxed text-ink-soft">
              {FINE_RULE[fine.type] ?? FINE_RULE.manual}
              {fine.unit_count && (fine.type === "overdue_daily" || fine.type === "reserve_hourly") ? (
                <span className="mt-1 block font-medium text-ink">
                  {fine.unit_count} {fine.type === "reserve_hourly" ? "hour" : "day"}
                  {Number(fine.unit_count) === 1 ? "" : "s"} ×{" "}
                  {formatPeso(
                    fine.type === "reserve_hourly" ? POLICY.reserveFinePerHour : POLICY.finePerDay,
                  )}{" "}
                  = {formatPeso(fine.amount)}
                </span>
              ) : null}
              {fine.computed_from && fine.computed_to ? (
                <span className="mt-1 block">
                  Period {formatDate(fine.computed_from)} – {formatDate(fine.computed_to)}
                </span>
              ) : null}
              {fine.notes ? <span className="mt-1 block italic">Desk note: {fine.notes}</span> : null}
              {fine.waiver_reason ? (
                <span className="mt-1 block">Waived: {fine.waiver_reason}</span>
              ) : null}
            </p>

            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              {fine.status === "pending" ? (
                <>
                  <Badge variant="warning">Not yet settled</Badge>
                  <span>Pay at the circulation desk — the librarian records the settlement.</span>
                </>
              ) : fine.status === "disputed" ? (
                <>
                  <Badge variant="info">Under review</Badge>
                  <span>The desk is reviewing this charge; borrowing stays on hold meanwhile.</span>
                </>
              ) : fine.status === "paid" ? (
                <>
                  <Badge variant="success">Settled</Badge>
                  <span>Paid {formatDate(settleDate(fine) ?? fine.created_at)}</span>
                  {fine.paid_via ? <span>· via {fine.paid_via}</span> : null}
                </>
              ) : (
                <>
                  <Badge variant="secondary">Waived</Badge>
                  <span>Written off {formatDate(settleDate(fine) ?? fine.created_at)}</span>
                </>
              )}
            </div>
          </li>
        ))}
      </ul>
    );

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="My account"
        title="Penalties"
        description="Every charge on your borrower record, the rule that produced it, and what you still owe. Fines are settled in person at the circulation desk — this page never takes payment."
        actions={
          fines.length > 0 ? <FineStatementActions info={info} rows={statementRows} /> : null
        }
      />

      {member.record?.is_blocked ? (
        <Alert variant="destructive">
          <ShieldAlert className="size-4" />
          <AlertTitle>Borrowing is on hold</AlertTitle>
          <AlertDescription>
            {member.record.block_reason ??
              `Your record has unsettled penalties (${formatPeso(member.record.outstanding_fines ?? 0)}).`}{" "}
            Settle the amount below at any branch desk and the hold is released the same day.
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Outstanding"
          value={formatPeso(outstanding)}
          hint={`${pending.length} charge${pending.length === 1 ? "" : "s"} to settle`}
          icon={<CircleDollarSign />}
          tone={outstanding > 0 ? "danger" : "success"}
        />
        <StatTile
          label="Settled"
          value={formatPeso(paid.reduce((sum, fine) => sum + Number(fine.amount ?? 0), 0))}
          hint={`${paid.length} paid at the desk`}
          icon={<BanknoteIcon />}
          tone="success"
        />
        <StatTile
          label="Waived"
          value={formatPeso(waived.reduce((sum, fine) => sum + Number(fine.amount ?? 0), 0))}
          hint={`${waived.length} written off`}
          icon={<CircleDollarSign />}
          tone="default"
        />
        <StatTile
          label="Still accruing"
          value={formatPeso(accruing)}
          hint="Estimated on your open loans"
          icon={<Calculator />}
          tone={accruing > 0 ? "warning" : "default"}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="size-4 text-brand-600" />
            Fine calculator
          </CardTitle>
          <CardDescription>
            Live estimate of what your overdue loans would cost if returned today, computed by the
            same database rule the desk uses. The final figure is fixed at check-in.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FineCalculator loans={calculatorLoans} />
        </CardContent>
      </Card>

      {fines.length === 0 ? (
        <EmptyState
          icon={<CircleDollarSign className="size-6" />}
          title="No penalties on your record"
          description="Nothing has been assessed against your account. Return your books by the due date and there will be nothing to pay."
          action={
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard/borrowings">See my borrowings</Link>
            </Button>
          }
        />
      ) : (
        <Tabs defaultValue="pending">
          <TabsList>
            <TabsTrigger value="pending">To settle ({pending.length})</TabsTrigger>
            <TabsTrigger value="paid">Settled ({paid.length})</TabsTrigger>
            <TabsTrigger value="waived">Waived ({waived.length})</TabsTrigger>
            {disputed.length > 0 ? (
              <TabsTrigger value="disputed">Under review ({disputed.length})</TabsTrigger>
            ) : null}
          </TabsList>
          <TabsContent value="pending">
            {group(
              pending,
              "Nothing to settle",
              "Every penalty on your account has been paid or written off.",
            )}
          </TabsContent>
          <TabsContent value="paid">
            {group(paid, "No settlements yet", "Paid charges appear here once the desk logs them.")}
          </TabsContent>
          <TabsContent value="waived">
            {group(
              waived,
              "No waived charges",
              "A librarian may write off a penalty; the reason is recorded here.",
            )}
          </TabsContent>
          {disputed.length > 0 ? (
            <TabsContent value="disputed">
              {group(
                disputed,
                "Nothing under review",
                "Disputed charges stay here until the desk decides.",
              )}
            </TabsContent>
          ) : null}
        </Tabs>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <Alert variant="info">
          <Info className="size-4" />
          <AlertTitle>How a fine is produced</AlertTitle>
          <AlertDescription>
            A circulating title accrues PHP {POLICY.finePerDay.toFixed(2)} per calendar day past its
            due date. A reserve title accrues PHP {POLICY.reserveFinePerHour.toFixed(2)} per hour
            past its expiry. A lost or damaged copy is charged by the desk against its acquisition
            price. Once your unsettled total reaches PHP {POLICY.fineBlockThreshold.toFixed(2)}, the
            system blocks further borrowing until you settle.
          </AlertDescription>
        </Alert>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Landmark className="size-4 text-brand-600" />
              Present this at the circulation desk
            </CardTitle>
            <CardDescription>
              Show the code below so the librarian can pull up your record and log the settlement.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-3 text-center">
            {deskQr && cardNumber ? (
              <>
                <span className="rounded-xl border border-brand-200 bg-parchment p-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={deskQr}
                    alt={`Library card code for ${member.user.full_name}`}
                    className="size-32"
                  />
                </span>
                <p className="font-mono text-sm text-ink">{cardNumber}</p>
              </>
            ) : (
              <div className="flex items-center gap-2 rounded-lg bg-secondary px-3 py-2 text-sm">
                <QrCode className="size-4 text-brand-600" />
                <span className="font-mono text-ink">
                  {member.profile?.sbtr_number ?? member.user.email}
                </span>
              </div>
            )}
            <p className="text-xs leading-relaxed text-muted-foreground">
              Cash settles at the desk counter only — this portal never takes payment. If you believe
              a charge is wrong, bring the item and receipt to the librarian and raise a dispute.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
