import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  BORROWER_TYPES,
  COLLEGE_PROGRAMS,
  EDUCATION_LEVELS,
  FACULTY_DEPARTMENTS,
  ROLE_LABEL,
  SENIOR_HIGH_TRACKS,
  labelFor,
} from "@/lib/constants";
import type { RoleSlug } from "@/lib/types";
import { formatDate, formatDateTime, formatPeso } from "@/lib/utils";
import { ACCOUNT_STATUS_LABEL, memberClassification, type ManagedUser } from "@/server/data/admin";

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="text-sm text-ink">{value}</dd>
    </div>
  );
}

/**
 * Read-only account standing for the detail sheet. Numbers come from
 * `borrower_records`, which Postgres maintains through the circulation triggers,
 * so this panel cannot drift from what the issue desk sees.
 */
export function UserDetailPanel({
  user,
  isSelf,
  activeAdminCount,
}: {
  user: ManagedUser;
  isSelf: boolean;
  activeAdminCount: number;
}) {
  const profile = user.profile;
  const record = user.record;

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {user.roles.length ? (
            user.roles.map((role: RoleSlug) => (
              <Badge key={role} variant={role === "admin" ? "gold" : role === "librarian" ? "info" : "secondary"}>
                {ROLE_LABEL[role]}
              </Badge>
            ))
          ) : (
            <Badge variant="outline">No role assigned</Badge>
          )}
          {user.is_active ? <Badge variant="success">Active</Badge> : <Badge variant="destructive">Deactivated</Badge>}
          {isSelf ? <Badge variant="secondary">Signed-in account</Badge> : null}
        </div>
        <dl className="grid gap-4 sm:grid-cols-2">
          <Field label="E-mail" value={<span className="break-all">{user.email}</span>} />
          <Field label="Registered" value={formatDate(user.created_at)} />
          <Field
            label="Last sign-in"
            value={user.last_login_at ? formatDateTime(user.last_login_at) : "Never signed in"}
          />
          <Field label="Account id" value={<code className="text-[11px]">{user.id}</code>} />
        </dl>
      </section>

      <Separator />

      <section className="flex flex-col gap-3">
        <h3 className="font-serif text-base font-semibold text-ink">Classification</h3>
        {profile ? (
          <dl className="grid gap-4 sm:grid-cols-2">
            <Field label="Borrower type" value={labelFor(BORROWER_TYPES, profile.borrower_type)} />
            <Field label="Level / department" value={labelFor(EDUCATION_LEVELS, profile.education_level)} />
            <Field
              label="Senior high track"
              value={profile.senior_high_track ? labelFor(SENIOR_HIGH_TRACKS, profile.senior_high_track) : "—"}
            />
            <Field
              label="College programme"
              value={profile.college_program ? labelFor(COLLEGE_PROGRAMS, profile.college_program) : "—"}
            />
            <Field
              label="Faculty department"
              value={
                profile.faculty_department ? labelFor(FACULTY_DEPARTMENTS, profile.faculty_department) : "—"
              }
            />
            <Field label="Short classification" value={memberClassification(profile)} />
            <Field
              label="SBTR number"
              value={
                profile.sbtr_number ? <code className="font-mono text-xs">{profile.sbtr_number}</code> : "Not issued"
              }
            />
            <Field
              label="Library card"
              value={profile.card_number ? <code className="font-mono text-xs">{profile.card_number}</code> : "Not issued"}
            />
            <Field label="Section" value={profile.section ?? "—"} />
            <Field label="Enrolment year" value={profile.enrollment_year ?? "—"} />
          </dl>
        ) : (
          <p className="text-sm text-muted-foreground">
            This account has no borrower profile yet — it exists purely as a staff login.
          </p>
        )}
      </section>

      <Separator />

      <section className="flex flex-col gap-3">
        <h3 className="font-serif text-base font-semibold text-ink">Borrowing standing</h3>
        {record ? (
          <>
            <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <Field label="Ledger status" value={ACCOUNT_STATUS_LABEL[record.status]} />
              <Field label="Limit" value={`${record.borrowing_limit} book(s)`} />
              <Field label="Loan period" value={`${record.loan_period_days} day(s)`} />
              <Field label="Out on loan" value={record.active_loans} />
              <Field
                label="Overdue"
                value={
                  record.overdue_loans > 0 ? (
                    <span className="font-semibold text-danger">{record.overdue_loans}</span>
                  ) : (
                    "0"
                  )
                }
              />
              <Field label="Lifetime loans" value={record.total_loans} />
              <Field label="Unsettled fines" value={formatPeso(record.outstanding_fines)} />
              <Field
                label="Last borrowed"
                value={record.last_borrowed_at ? formatDate(record.last_borrowed_at) : "Never borrowed"}
              />
              <Field
                label="Desk hold"
                value={
                  record.is_blocked ? (
                    <Badge variant="destructive">Blocked</Badge>
                  ) : (
                    <Badge variant="success">Clear to borrow</Badge>
                  )
                }
              />
            </dl>
            {record.block_reason ? (
              <p className="rounded-lg border border-destructive/25 bg-destructive/5 p-3 text-xs leading-relaxed text-destructive">
                <span className="font-semibold">Hold reason: </span>
                {record.block_reason}
              </p>
            ) : null}
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            No borrower ledger entry — this account has never been registered as a borrower, so it
            cannot issue books to itself.
          </p>
        )}
      </section>

      {isSelf || activeAdminCount <= 1 ? (
        <p className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-xs leading-relaxed text-warning">
          <span className="font-semibold">Protected account. </span>
          {isSelf
            ? "You cannot demote or deactivate the account you are signed in with — the console refuses the change on the server, not only in this dialog."
            : `This is the only active administrator left. Promote a second administrator before this account can be demoted or deactivated, otherwise the console would lock itself.`}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
        <span>Role changes, activation and classification are edited from the “Manage account” dialog.</span>
      </div>
    </div>
  );
}
