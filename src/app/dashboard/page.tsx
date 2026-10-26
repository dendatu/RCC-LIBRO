import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowRight,
  BookOpenCheck,
  CalendarClock,
  CircleDollarSign,
  Library,
  ScanBarcode,
  Sparkles,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { StatTile } from "@/components/ui/stat-tile";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/shell/page-header";
import { createClient } from "@/lib/supabase/server";
import { getMember, isStaff } from "@/lib/rbac";
import { POLICY, ROLE_LABEL, SECTION_META, classificationLabel } from "@/lib/constants";
import { formatDate, formatPeso, relativeDue } from "@/lib/utils";
import type { BorrowerSummary, DashboardStats } from "@/lib/types";

export const dynamic = "force-dynamic";

type LoanRow = {
  id: string;
  reference_no: string;
  due_date: string;
  status: string;
  is_overdue: boolean;
  book: { title: string; author: string; accession_number: string; section: string } | null;
};

export default async function DashboardPage() {
  const member = await getMember();
  if (!member) notFound();

  const supabase = await createClient();

  const summaryRes = supabase.rpc("borrower_summary", { p_user_id: member.user.id });
  const loansRes = supabase
    .from("borrow_transactions")
    .select("id, reference_no, due_date, status, is_overdue, book:books(title, author, accession_number, section)")
    .eq("borrower_id", member.user.id)
    .in("status", ["active", "overdue"])
    .order("due_date")
    .limit(5);

  const [summary, loans] = await Promise.all([summaryRes, loansRes]);
  const stats = (summary.data ?? {}) as BorrowerSummary;
  const rows = (loans.data ?? []) as unknown as LoanRow[];

  let staffStats: DashboardStats | null = null;
  if (isStaff(member)) {
    const { data } = await supabase.rpc("dashboard_stats");
    staffStats = (data ?? null) as DashboardStats | null;
  }

  const outstanding = Number(stats.pending_fines ?? 0);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={`Signed in as ${ROLE_LABEL[member.role]}`}
        title={`Welcome back, ${member.user.full_name.split(" ")[0]}`}
        description={
          member.profile
            ? `${classificationLabel(member.profile)} · ${POLICY.maxBooks} books maximum · ${POLICY.loanDays}-day loans`
            : "Finish your borrower profile so the circulation desk can release loans to you."
        }
        actions={
          <>
            <Link
              href="/dashboard/catalog"
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium transition-colors hover:border-brand-300 hover:bg-muted"
            >
              <Library className="size-4" /> Browse catalogue
            </Link>
            {isStaff(member) ? (
              <Link
                href="/dashboard/circulation"
                className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-cream transition-colors hover:bg-brand-700"
              >
                <ScanBarcode className="size-4" /> Issue books
              </Link>
            ) : null}
          </>
        }
      />

      {member.record?.is_blocked ? (
        <Alert variant="destructive">
          <CircleDollarSign className="size-4" />
          <AlertTitle>Borrowing privileges are on hold</AlertTitle>
          <AlertDescription>
            {member.record.block_reason ??
              `You have ${member.record.overdue_loans} overdue loan(s) and ${formatPeso(member.record.outstanding_fines)} in unsettled penalties.`}{" "}
            <Link href="/dashboard/penalties" className="font-medium underline underline-offset-4">
              Review penalties
            </Link>
          </AlertDescription>
        </Alert>
      ) : !member.profile?.borrower_type ? (
        <Alert className="border-gold/40 bg-gold-soft/30 text-brand-900">
          <Sparkles className="size-4" />
          <AlertTitle>Your library card is not complete</AlertTitle>
          <AlertDescription>
            Students need a level and an SBTR number; faculty need a department.{" "}
            <Link href="/dashboard/profile?onboard=1" className="font-medium underline underline-offset-4">
              Complete your profile
            </Link>
          </AlertDescription>
        </Alert>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Books out"
          value={String(stats.active_loans ?? 0)}
          hint={`Limit ${member.record?.borrowing_limit ?? POLICY.maxBooks} at a time`}
          icon={<BookOpenCheck />}
        />
        <StatTile
          label="Due within 3 days"
          value={String(stats.due_soon ?? 0)}
          hint="Bring these to the desk first"
          icon={<CalendarClock />}
          tone={Number(stats.due_soon ?? 0) > 0 ? "gold" : "default"}
        />
        <StatTile
          label="Overdue"
          value={String(stats.overdue ?? 0)}
          hint={POLICY.finePerDay ? `PHP ${POLICY.finePerDay.toFixed(2)} per day` : ""}
          icon={<CircleDollarSign />}
          tone={Number(stats.overdue ?? 0) > 0 ? "danger" : "success"}
        />
        <StatTile
          label="Unsettled penalties"
          value={formatPeso(outstanding)}
          hint={`${stats.open_reservations ?? 0} reservation(s) open`}
          icon={<CircleDollarSign />}
          tone={outstanding > 0 ? "warning" : "success"}
          href="/dashboard/penalties"
        />
      </section>

      {staffStats ? <StaffSnapshot stats={staffStats} /> : null}

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Current loans</CardTitle>
            <CardDescription>Titles out under your name, closest due date first.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {rows.length === 0 ? (
              <EmptyState
                icon={<BookOpenCheck className="size-7" />}
                title="Nothing checked out"
                description="Search the catalogue or scan a QR label at the shelf to start a loan."
                action={
                  <Link
                    href="/dashboard/catalog"
                    className="inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:underline"
                  >
                    Find a book <ArrowRight className="size-4" />
                  </Link>
                }
              />
            ) : (
              rows.map((loan) => {
                const section = loan.book?.section as keyof typeof SECTION_META | undefined;
                return (
                  <Link
                    key={loan.id}
                    href={`/dashboard/borrowings#${loan.id}`}
                    className="block rounded-lg border border-border p-4 transition-colors hover:border-brand-300 hover:bg-muted/50"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-medium text-ink">{loan.book?.title}</p>
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                          {loan.book?.author} · accession {loan.book?.accession_number}
                        </p>
                      </div>
                      <Badge variant={loan.is_overdue ? "destructive" : "secondary"}>
                        {relativeDue(loan.due_date)}
                      </Badge>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                      <span className="font-mono">{loan.reference_no}</span>
                      {section ? (
                        <span className={`rounded-full px-2 py-0.5 ${SECTION_META[section].hue}`}>
                          {SECTION_META[section].label}
                        </span>
                      ) : null}
                      <span>Due {formatDate(loan.due_date)}</span>
                    </div>
                  </Link>
                );
              })
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Desk reminders</CardTitle>
            <CardDescription>How RCC circulation works.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-ink-soft">
            {[
              `Hold at most ${POLICY.maxBooks} books for ${POLICY.loanDays} days.`,
              `Overdue books accrue PHP ${POLICY.finePerDay.toFixed(2)} per day, weekends and holidays included.`,
              `Reserve books: ${POLICY.reserveMinutes} minutes in-library, take-home from ${POLICY.reserveTakeHomeHour}:00, PHP ${POLICY.reserveFinePerHour.toFixed(2)} per hour late.`,
              "Reference and periodicals are for library use only.",
              "Reminders are e-mailed 7, 3 and 1 days before the due date.",
            ].map((line) => (
              <p key={line} className="flex gap-2">
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-gold" />
                {line}
              </p>
            ))}
            <Link
              href="/policies"
              className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:underline"
            >
              Full borrowing policy <ArrowRight className="size-4" />
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StaffSnapshot({ stats }: { stats: DashboardStats }) {
  return (
    <section className="surface-card p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-serif text-lg text-ink">Circulation snapshot</h2>
        <Link
          href="/dashboard/analytics"
          className="inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:underline"
        >
          Open analytics <ArrowRight className="size-4" />
        </Link>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        {[
          { label: "Catalogued titles", value: stats.total_books },
          { label: "Copies on shelf", value: stats.available_copies },
          { label: "On loan", value: stats.borrowed_copies },
          { label: "Overdue loans", value: stats.overdue_loans, tone: "text-danger" },
          { label: "Lost copies", value: stats.lost_copies, tone: "text-warning" },
          { label: "Fines collected", value: formatPeso(stats.collected_fines) },
        ].map((item) => (
          <div key={item.label} className="rounded-lg bg-muted/60 p-3">
            <p className={`font-serif text-xl ${item.tone ?? "text-ink"}`}>{item.value}</p>
            <p className="mt-1 text-[11px] uppercase tracking-wide text-muted-foreground">
              {item.label}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
