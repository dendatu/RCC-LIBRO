import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ScanBarcode } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { MemberEditor } from "@/components/circulation/member-editor";
import { HistoryPdfButton } from "@/components/circulation/pdf-download";
import { fineTypeLabel } from "@/components/circulation/section-rule";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ROLE_LABEL, SECTION_META } from "@/lib/constants";
import { requireRole } from "@/lib/rbac";
import { formatDate, formatDateTime, formatPeso, relativeDue } from "@/lib/utils";
import { getMemberDetail } from "@/server/data/circulation";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Borrower record",
  description: "Classification, SBTR ledger, penalties and staff edit of the borrowing entitlement.",
};

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg bg-muted/60 p-3">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-medium text-ink">{value}</p>
    </div>
  );
}

export default async function MemberDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole("librarian", "admin");
  const { id } = await params;
  const detail = await getMemberDetail(id);
  if (!detail) notFound();

  const { member, sbtr, fines, openLoans, roles, eligibility } = detail;
  const pendingFines = fines.filter((fine) => fine.status === "pending");
  const outstanding = pendingFines.reduce((sum, fine) => sum + Number(fine.amount ?? 0), 0);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Borrower record"
        title={member.full_name}
        description={`${member.classification} · ${member.email}`}
        actions={
          <>
            <Button asChild variant="gold">
              <Link href={`/dashboard/circulation?borrower=${member.user_id}`}>
                <ScanBarcode className="size-4" /> Issue a book
              </Link>
            </Button>
            <HistoryPdfButton
              info={{
                name: member.full_name,
                email: member.email,
                classification: member.classification,
                sbtr: member.sbtr_number,
                card: member.card_number,
              }}
              rows={sbtr.map((row) => ({
                reference_no: row.reference_no,
                title: row.book_title,
                accession_number: row.accession_number,
                date_borrowed: row.date_borrowed,
                due_date: row.due_date,
                date_returned: row.date_returned,
                status: row.status,
                fine: row.fine_charged,
              }))}
            />
            <Button asChild variant="outline">
              <Link href="/dashboard/members">
                <ArrowLeft className="size-4" /> All records
              </Link>
            </Button>
          </>
        }
      />

      {eligibility && !eligibility.eligible ? (
        <Alert variant="destructive">
          <AlertTitle>Held at the desk</AlertTitle>
          <AlertDescription>
            <p>Postgres will not release a loan to this borrower right now:</p>
            <ul className="mt-2 list-disc space-y-1 pl-4">
              {eligibility.reasons.map((reason) => (
                <li key={reason.code}>{reason.message}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="space-y-6 lg:col-span-3">
          <section className="surface-card space-y-4 p-5">
            <h2 className="font-serif text-lg text-ink">Account and classification</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="E-mail" value={member.email} />
              <Field label="Contact" value={member.contact_number ?? "not recorded"} />
              <Field
                label="Roles"
                value={
                  <span className="flex flex-wrap gap-1.5">
                    {roles.map((role) => (
                      <Badge key={role} variant={role === "borrower" ? "secondary" : "gold"}>
                        {ROLE_LABEL[role]}
                      </Badge>
                    ))}
                  </span>
                }
              />
              <Field label="Member since" value={formatDate(member.member_since)} />
              <Field label="Library card" value={member.card_number ?? "not issued"} />
              <Field label="SBTR number" value={member.sbtr_number ?? "no SBTR issued"} />
              <Field label="ID number" value={member.profile?.id_number ?? "—"} />
              <Field
                label="Enrolment year"
                value={member.profile?.enrollment_year ? String(member.profile.enrollment_year) : "—"}
              />
              <Field label="Last seen" value={member.last_login_at ? formatDateTime(member.last_login_at) : "never"} />
              <Field
                label="Section"
                value={member.profile?.section ?? "—"}
              />
            </div>
          </section>

          <section className="surface-card space-y-4 p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-serif text-lg text-ink">Borrowing entitlement</h2>
              <Badge variant={member.standing === "active" ? "success" : member.standing === "suspended" ? "destructive" : "secondary"}>
                {member.standing}
              </Badge>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field
                label="Active loans"
                value={`${member.active_loans} of ${member.record?.borrowing_limit ?? 3}`}
              />
              <Field label="Overdue loans" value={member.overdue_loans} />
              <Field label="Lifetime loans" value={member.record?.total_loans ?? 0} />
              <Field
                label="Loan period"
                value={`${member.record?.loan_period_days ?? 7} days`}
              />
              <Field label="Outstanding penalties" value={formatPeso(member.outstanding_fines)} />
              <Field
                label="Last borrowed"
                value={member.record?.last_borrowed_at ? formatDate(member.record.last_borrowed_at) : "never"}
              />
            </div>
            {member.is_blocked ? (
              <Alert variant="warning">
                <AlertDescription>
                  Held at the desk: {member.record?.block_reason ?? "unresolved penalties"}. Settle the
                  penalty or waive it at the fine desk to clear the account.
                </AlertDescription>
              </Alert>
            ) : null}
          </section>

          <section className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-serif text-lg text-ink">Loans out</h2>
              <Button asChild size="sm" variant="outline">
                <Link href="/dashboard/returns">Return desk</Link>
              </Button>
            </div>
            {!openLoans.length ? (
              <EmptyState
                title="Nothing out on loan"
                description="This borrower has no open transaction at any branch."
              />
            ) : (
              <Table containerClassName="overflow-x-auto rounded-xl border border-border">
                <TableHeader>
                  <TableRow>
                    <TableHead>Reference</TableHead>
                    <TableHead className="min-w-[14rem]">Title</TableHead>
                    <TableHead>Due</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {openLoans.map((loan) => (
                    <TableRow key={loan.id}>
                      <TableCell className="font-mono text-xs">{loan.reference_no}</TableCell>
                      <TableCell>
                        <p className="text-sm text-ink">{loan.book_title}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {loan.accession_number} · {loan.library_name} ·{" "}
                          {SECTION_META[loan.section]?.label ?? loan.section}
                        </p>
                      </TableCell>
                      <TableCell>
                        <p className="text-sm text-ink">{formatDate(loan.due_date)}</p>
                        <p className="text-[11px] text-muted-foreground">{relativeDue(loan.due_date)}</p>
                      </TableCell>
                      <TableCell>
                        <Badge variant={loan.status === "overdue" ? "destructive" : "info"}>{loan.status}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </section>

          <section className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-serif text-lg text-ink">Penalties</h2>
              <p className="text-xs text-ink-soft">
                {formatPeso(outstanding)} unsettled across {pendingFines.length} entry(ies)
              </p>
            </div>
            {!fines.length ? (
              <EmptyState title="No penalties" description="Nothing has been charged against this account." />
            ) : (
              <Table containerClassName="overflow-x-auto rounded-xl border border-border">
                <TableHeader>
                  <TableRow>
                    <TableHead>Raised</TableHead>
                    <TableHead className="min-w-[12rem]">Penalty</TableHead>
                    <TableHead className="min-w-[12rem]">Title</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {fines.map((fine) => (
                    <TableRow key={fine.id}>
                      <TableCell className="text-xs text-muted-foreground">{formatDate(fine.created_at)}</TableCell>
                      <TableCell>
                        <p className="text-sm text-ink">{fineTypeLabel(fine.type)}</p>
                        {fine.unit_count > 0 ? (
                          <p className="text-[11px] text-muted-foreground">{fine.unit_count} unit(s)</p>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        <p className="text-sm text-ink">{fine.book_title ?? "—"}</p>
                        {fine.reference_no ? (
                          <p className="font-mono text-[11px] text-muted-foreground">{fine.reference_no}</p>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            fine.status === "pending"
                              ? "destructive"
                              : fine.status === "paid"
                                ? "success"
                                : fine.status === "disputed"
                                  ? "warning"
                                  : "secondary"
                          }
                        >
                          {fine.status}
                        </Badge>
                        {fine.paid_via ? (
                          <p className="mt-1 text-[11px] text-muted-foreground">via {fine.paid_via}</p>
                        ) : null}
                        {fine.waiver_reason ? (
                          <p className="mt-1 text-[11px] text-muted-foreground">{fine.waiver_reason}</p>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-right font-semibold text-ink">{formatPeso(fine.amount)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
            <div className="flex flex-wrap gap-2">
              <Button asChild size="sm" variant="outline">
                <Link href={`/dashboard/fines?borrower=${member.user_id}`}>Open at the fine desk</Link>
              </Button>
            </div>
          </section>
        </div>

        <div className="space-y-6 lg:col-span-2">
          <MemberEditor member={member} />

          <section className="surface-card space-y-3 p-5">
            <h2 className="font-serif text-lg text-ink">Desk notes</h2>
            <p className="text-sm text-ink-soft">
              An active SBTR is required before any loan is released to a student; faculty borrow
              against their department ID. Penalties are settled at the fine desk, and only an
              administrator may waive one.
            </p>
            <p className="text-xs text-muted-foreground">
              Loan limit, standing and classification changes made on this page are written to the
              audit trail with your name against them.
            </p>
          </section>
        </div>
      </div>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-serif text-lg text-ink">Student Book Tracer Record</h2>
          <p className="text-xs text-muted-foreground">
            {sbtr.length} entr(ies) — the digital equivalent of the paper tracer book
          </p>
        </div>
        {!sbtr.length ? (
          <EmptyState
            title="No entries yet"
            description="Every loan and return is written to the tracer record as it happens."
          />
        ) : (
          <Table containerClassName="overflow-x-auto rounded-xl border border-border">
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">#</TableHead>
                <TableHead>Reference</TableHead>
                <TableHead className="min-w-[14rem]">Title</TableHead>
                <TableHead>Accession</TableHead>
                <TableHead>Branch</TableHead>
                <TableHead>Borrowed</TableHead>
                <TableHead>Due</TableHead>
                <TableHead>Returned</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Fine</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sbtr.map((row, index) => (
                <TableRow key={row.id}>
                  <TableCell className="text-xs text-muted-foreground">{index + 1}</TableCell>
                  <TableCell className="font-mono text-xs">{row.reference_no}</TableCell>
                  <TableCell>
                    <p className="text-sm text-ink">{row.book_title}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {row.book_author} · {SECTION_META[row.section]?.label ?? row.section}
                    </p>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{row.accession_number}</TableCell>
                  <TableCell className="text-xs">{row.library_name}</TableCell>
                  <TableCell className="text-xs">{formatDate(row.date_borrowed)}</TableCell>
                  <TableCell className="text-xs">{formatDate(row.due_date)}</TableCell>
                  <TableCell className="text-xs">{row.date_returned ? formatDate(row.date_returned) : "—"}</TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        row.status === "overdue"
                          ? "destructive"
                          : row.status === "returned"
                            ? "success"
                            : row.status === "lost"
                              ? "destructive"
                              : "info"
                      }
                    >
                      {row.status}
                    </Badge>
                    {row.overdue_days > 0 ? (
                      <p className="mt-1 text-[11px] text-destructive">{row.overdue_days} day(s) late</p>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-right text-sm">{formatPeso(row.fine_charged)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>
    </div>
  );
}
