import type { Metadata } from "next";
import Link from "next/link";
import { Clock4, Mail, MailWarning, Search, ShieldCheck } from "lucide-react";
import { EmailJobControls } from "@/components/admin/email-job-controls";
import { PageHeader } from "@/components/shell/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { StatTile } from "@/components/ui/stat-tile";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { emailConfig } from "@/lib/env";
import { requireRole } from "@/lib/rbac";
import { formatDateTime, formatNumber } from "@/lib/utils";
import {
  getEmailCounters,
  getEmailTemplateOptions,
  listEmailLogs,
  relativeTime,
} from "@/server/data/admin";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "E-mail centre",
  description:
    "Reminder queue, delivery journal and the scheduled job that stages due-date and overdue notices for RCC LIBRO borrowers.",
};

const PER_PAGE = 25;

const EMAIL_STATUSES = ["queued", "sent", "failed", "skipped", "bounced"] as const;

type EmailStatus = (typeof EMAIL_STATUSES)[number];

const STATUS_VARIANT: Record<EmailStatus, React.ComponentProps<typeof Badge>["variant"]> = {
  queued: "warning",
  sent: "success",
  failed: "destructive",
  skipped: "outline",
  bounced: "destructive",
};

const STATUS_COPY: Record<EmailStatus, string> = {
  queued: "Waiting in the queue",
  sent: "Delivered by the provider",
  failed: "Provider rejected it — will retry",
  skipped: "Not sent (no provider key, or duplicate)",
  bounced: "Rejected after delivery attempt",
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function single(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function buildQuery(base: Record<string, string>, overrides: Record<string, string | undefined>) {
  const merged = { ...base, ...overrides };
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(merged)) {
    if (value) params.set(key, value);
  }
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export default async function AdminEmailPage({ searchParams }: { searchParams: SearchParams }) {
  const actor = await requireRole("admin");
  const params = await searchParams;

  const base = {
    status: single(params.status) ?? "",
    template: single(params.template) ?? "",
    page: single(params.page) ?? "",
  };
  const page = base.page ? Math.max(1, Number(base.page) || 1) : 1;

  const [counters, templates, journal] = await Promise.all([
    getEmailCounters(),
    getEmailTemplateOptions(),
    listEmailLogs({
      status: base.status || undefined,
      template: base.template || undefined,
      page,
      perPage: PER_PAGE,
    }),
  ]);

  const pageCount = Math.max(1, Math.ceil(journal.total / PER_PAGE));
  const filtered = Boolean(base.status || base.template);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Administration"
        title="E-mail centre"
        description="Every reminder, overdue notice and welcome message the system stages, sends or refuses — with the counters and the manual switch that runs the scheduled job on demand."
        actions={
          <Badge variant={emailConfig.enabled ? "success" : "warning"} className="gap-1.5">
            <Mail className="size-3.5" />
            {emailConfig.enabled ? "Resend connected" : "No provider key"}
          </Badge>
        }
      />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5" aria-label="Message counters">
        <StatTile
          label="Queued"
          value={formatNumber(counters.queued)}
          hint={STATUS_COPY.queued}
          icon={<Mail className="size-4" />}
          tone={counters.queued > 0 ? "warning" : "default"}
        />
        <StatTile
          label="Sent"
          value={formatNumber(counters.sent)}
          hint={STATUS_COPY.sent}
          icon={<ShieldCheck className="size-4" />}
          tone="success"
        />
        <StatTile
          label="Failed"
          value={formatNumber(counters.failed)}
          hint={STATUS_COPY.failed}
          icon={<MailWarning className="size-4" />}
          tone={counters.failed > 0 ? "danger" : "default"}
        />
        <StatTile
          label="Skipped"
          value={formatNumber(counters.skipped)}
          hint={STATUS_COPY.skipped}
          icon={<Clock4 className="size-4" />}
        />
        <StatTile
          label="Bounced"
          value={formatNumber(counters.bounced)}
          hint={STATUS_COPY.bounced}
          icon={<MailWarning className="size-4" />}
          tone={counters.bounced > 0 ? "danger" : "default"}
        />
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Operations</CardTitle>
          <CardDescription>
            Run the daily sweep without waiting for the schedule, or send yourself a message to
            prove the provider wiring.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <EmailJobControls
            adminEmail={actor.user.email}
            deliveryMode={emailConfig.enabled ? "resend" : "outbox"}
          />
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>What runs on the schedule</CardTitle>
            <CardDescription>
              Vercel Cron calls <code className="font-mono text-[11px]">GET /api/cron/reminders</code>{" "}
              once a day using the entry declared in vercel.json — 0 18 * * *, i.e. 18:00 UTC, which
              is 02:00 the following morning in Angeles City.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm text-ink-soft">
            <ol className="flex flex-col gap-2">
              <li className="flex gap-2">
                <span className="mt-0.5 size-5 shrink-0 rounded-full bg-brand-100 text-center text-[11px] font-semibold leading-5 text-brand-800">
                  1
                </span>
                <span>
                  The request must carry{" "}
                  <code className="rounded bg-muted px-1 py-0.5 font-mono text-[11px]">
                    Authorization: Bearer …
                  </code>{" "}
                  matching <code className="font-mono text-[11px]">CRON_SECRET</code>. Without a
                  secret configured the route only answers in development, so a production scanner
                  cannot trigger it.
                </span>
              </li>
              <li className="flex gap-2">
                <span className="mt-0.5 size-5 shrink-0 rounded-full bg-brand-100 text-center text-[11px] font-semibold leading-5 text-brand-800">
                  2
                </span>
                <span>
                  <code className="font-mono text-[11px]">stage_due_reminders()</code> runs with the
                  service role. It first marks loans overdue, then inserts a reminder for every loan
                  reaching each configured lead day (7, 3 and 1 by default) plus one overdue notice
                  per late loan.
                </span>
              </li>
              <li className="flex gap-2">
                <span className="mt-0.5 size-5 shrink-0 rounded-full bg-brand-100 text-center text-[11px] font-semibold leading-5 text-brand-800">
                  3
                </span>
                <span>
                  <code className="font-mono text-[11px]">deliverQueuedEmails(60)</code> drains up
                  to sixty queued rows through Resend and writes the outcome back to this journal —
                  sent, failed or skipped.
                </span>
              </li>
            </ol>
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              The button above executes the same path, so a manual press and the nightly run are
              indistinguishable in this journal.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Duplicate protection</CardTitle>
            <CardDescription>
              Borrowers must never receive the same reminder twice, and the library must never pay
              for a second send.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 text-sm text-ink-soft">
            <p>
              Each staged message carries a{" "}
              <code className="rounded bg-muted px-1 py-0.5 font-mono text-[11px]">dedupe_key</code>{" "}
              that the database enforces as unique:{" "}
              <code className="font-mono text-[11px]">reminder:&lt;stage&gt;:&lt;loan id&gt;</code>{" "}
              for the advance notices and{" "}
              <code className="font-mono text-[11px]">overdue:&lt;loan id&gt;</code> for the overdue
              notice. A loan can therefore generate exactly one message per lead day.
            </p>
            <p>
              Because the guard lives in Postgres, it holds across every entry point — the schedule,
              the button above, a retried deployment or two overlapping runs. Nothing is inserted,
              nothing is queued and nothing is billed.
            </p>
            <Alert variant="info">
              <ShieldCheck className="size-4" />
              <AlertTitle>A row only becomes eligible again when its send failed</AlertTitle>
              <AlertDescription>
                Failed deliveries stay in the queue and are retried by the next run. Bounced or
                refused addresses are journed here with the provider error so the desk can correct
                the account record.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Delivery journal</CardTitle>
          <CardDescription>
            Newest first. The dedupe key is shown so a repeat press can be verified as harmless.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <form method="get" className="flex flex-wrap items-center gap-2">
            <select
              name="status"
              aria-label="Filter by delivery status"
              defaultValue={base.status}
              className="h-9 rounded-lg border border-input bg-card px-3 text-sm text-foreground shadow-xs outline-none transition-[color,box-shadow,border-color] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/25"
            >
              <option value="">Any status</option>
              {EMAIL_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>

            <select
              name="template"
              aria-label="Filter by template"
              defaultValue={base.template}
              className="h-9 max-w-[14rem] rounded-lg border border-input bg-card px-3 text-sm text-foreground shadow-xs outline-none transition-[color,box-shadow,border-color] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/25"
            >
              <option value="">Any template</option>
              {templates.map((template) => (
                <option key={template} value={template}>
                  {template}
                </option>
              ))}
            </select>

            <Button type="submit" size="sm">
              <Search className="size-4" />
              Apply
            </Button>
            {filtered ? (
              <Button asChild variant="ghost" size="sm">
                <Link href="/dashboard/admin/email">Clear</Link>
              </Button>
            ) : null}
            <span className="text-xs text-muted-foreground">
              {formatNumber(journal.total)} message(s)
            </span>
          </form>

          {journal.rows.length === 0 ? (
            <EmptyState
              icon={<MailWarning className="size-7" />}
              title="Nothing journaled yet"
              description="Run the reminder job, or wait for the scheduled sweep, and messages will be listed here."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead scope="col">Recipient</TableHead>
                  <TableHead scope="col">Template</TableHead>
                  <TableHead scope="col">Subject</TableHead>
                  <TableHead scope="col">Status</TableHead>
                  <TableHead scope="col">Dedupe key</TableHead>
                  <TableHead scope="col">Queued</TableHead>
                  <TableHead scope="col">Result</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {journal.rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>
                      <p className="text-sm text-ink">{row.recipient}</p>
                      <p className="text-[11px] text-muted-foreground">{row.provider}</p>
                    </TableCell>
                    <TableCell>
                      <span className="font-mono text-[11px] text-brand-700">{row.template}</span>
                    </TableCell>
                    <TableCell className="max-w-[22rem]">
                      <p className="truncate text-sm text-ink-soft" title={row.subject}>
                        {row.subject}
                      </p>
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[row.status] ?? "outline"} title={STATUS_COPY[row.status]}>
                        {row.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-[11px] text-muted-foreground">
                      {row.dedupe_key ?? "—"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                      <p>{relativeTime(row.queued_at)}</p>
                      <p className="text-[11px]">{formatDateTime(row.queued_at)}</p>
                    </TableCell>
                    <TableCell className="max-w-[16rem] text-[11px]">
                      {row.sent_at ? (
                        <p className="text-success">Sent {relativeTime(row.sent_at)}</p>
                      ) : null}
                      {row.error ? (
                        <p className="truncate text-danger" title={row.error}>
                          {row.error}
                        </p>
                      ) : null}
                      {!row.sent_at && !row.error ? (
                        <span className="text-muted-foreground">Awaiting delivery</span>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {pageCount > 1 ? (
            <nav className="flex items-center justify-center gap-3" aria-label="Message journal pages">
              {page > 1 ? (
                <Button asChild size="sm" variant="outline">
                  <Link href={`/dashboard/admin/email${buildQuery(base, { page: String(page - 1) })}`}>
                    Previous
                  </Link>
                </Button>
              ) : null}
              <p className="text-sm text-muted-foreground">
                Page {page} of {pageCount}
              </p>
              {page < pageCount ? (
                <Button asChild size="sm" variant="outline">
                  <Link href={`/dashboard/admin/email${buildQuery(base, { page: String(page + 1) })}`}>
                    Next
                  </Link>
                </Button>
              ) : null}
            </nav>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
