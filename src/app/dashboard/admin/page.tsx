import type { Metadata } from "next";
import {
  AlertTriangle,
  Boxes,
  Building2,
  Calculator,
  CircleDollarSign,
  Clock,
  Database,
  Library,
  MailWarning,
  PlugZap,
  ScrollText,
  Settings,
  ShieldCheck,
  UserCog,
  Users,
} from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { AccountRolesCard, AdminQuickLinks, DemoCredentialWarning } from "@/components/admin/console-notices";
import { ConsoleActivity } from "@/components/admin/console-activity";
import { IntegrationHealth, type HealthCheck } from "@/components/admin/integration-health";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StatTile } from "@/components/ui/stat-tile";
import { emailConfig, env } from "@/lib/env";
import { requireRole } from "@/lib/rbac";
import { createClient } from "@/lib/supabase/server";
import { formatNumber, formatPeso } from "@/lib/utils";
import { getConsoleOverview } from "@/server/data/admin";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Admin console",
  description:
    "System vitals, account roles, integration health and the go-live checklist for the RCC LIBRO library system.",
};

/**
 * Addresses created by migration 00009. Their existence is the console&rsquo;s only
 * reliable signal that the demo data set is still in the database: the shared
 * password itself cannot be read back, so the warning is keyed on the accounts
 * rather than on a credential.
 */
const SEEDED_ACCOUNTS = [
  "admin@rcc.edu.ph",
  "librarian@rcc.edu.ph",
  "circ@rcc.edu.ph",
  "student@rcc.edu.ph",
  "grade6@rcc.edu.ph",
  "shs@rcc.edu.ph",
  "grad@rcc.edu.ph",
];

async function seededAccountsPresent() {
  const supabase = await createClient();
  const { count } = await supabase
    .from("users")
    .select("id", { count: "exact", head: true })
    .in("email", SEEDED_ACCOUNTS);
  return (count ?? 0) > 0;
}

/** Presence-only reading of the environment — no secret is ever rendered. */
function buildHealthChecks(): HealthCheck[] {
  const supabaseReady = Boolean(env.NEXT_PUBLIC_SUPABASE_URL && env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  const serviceReady = Boolean(env.SUPABASE_SERVICE_ROLE_KEY);
  const mailReady = emailConfig.enabled;
  const cronReady = Boolean(env.CRON_SECRET);

  return [
    {
      id: "supabase",
      label: "Supabase session client",
      state: supabaseReady ? "ready" : "missing",
      detail: supabaseReady
        ? "Public URL and anon key are set, so signed-in members can read the catalogue under row-level security."
        : "NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY is absent, so no page can reach the database.",
      remedy: "Copy both values from Project Settings → API into .env.local and redeploy.",
    },
    {
      id: "service-role",
      label: "Service-role key",
      state: serviceReady ? "ready" : "partial",
      detail: serviceReady
        ? "SUPABASE_SERVICE_ROLE_KEY is present, so the e-mail journal, the reminder sweep and the admin-only tables are reachable."
        : "Without SUPABASE_SERVICE_ROLE_KEY the app still runs for borrowers, but e-mail delivery cannot be journaled and the reminder job refuses to run.",
      remedy:
        "Add the service-role key to the server environment only. It bypasses row-level security and must never be exposed to the browser.",
    },
    {
      id: "mail",
      label: "Outgoing e-mail provider",
      state: mailReady ? "ready" : "partial",
      detail: mailReady
        ? `${emailConfig.label} is configured; notices are sent from ${emailConfig.fromAddress}.`
        : emailConfig.notice ??
          "No MAIL_SMTP_* relay and no RESEND_API_KEY, so due-date reminders and overdue notices are written to the journal as skipped instead of being delivered.",
      remedy:
        "Set MAIL_SMTP_HOST / MAIL_SMTP_USER / MAIL_SMTP_PASS for an SMTP relay such as Gmail, or RESEND_API_KEY, then confirm delivery with the test message in the e-mail centre.",
    },
    {
      id: "cron",
      label: "Scheduled reminder job",
      state: cronReady ? "ready" : "partial",
      detail: cronReady
        ? "CRON_SECRET is set, so GET /api/cron/reminders accepts the bearer token Vercel Cron sends each day."
        : "CRON_SECRET is missing: the cron route only answers in development, so reminders never run on their own.",
      remedy: "Generate a long secret, store it as CRON_SECRET, and confirm the schedule entry in vercel.json.",
    },
    {
      id: "sender",
      label: "Verified sender address",
      state: emailConfig.enabled ? "ready" : "partial",
      detail: emailConfig.enabled
        ? `Messages leave as ${emailConfig.from}. ${
            emailConfig.provider === "smtp"
              ? `The relay at ${emailConfig.smtp?.host} decides whether this mailbox may use that address.`
              : "Resend refuses any domain it has not verified."
          }`
        : "Nothing is delivered yet, so the From line is only a placeholder.",
      remedy:
        "Set MAIL_FROM to an address the provider accepts. Gmail's SMTP only sends as the authenticated account, so MAIL_SMTP_USER and MAIL_FROM must agree.",
    },
  ];
}

const QUICK_LINKS = [
  {
    href: "/dashboard/admin/users",
    label: "Users and roles",
    description: "Grant librarian or administrator access, classify borrowers, close accounts.",
    icon: <UserCog />,
  },
  {
    href: "/dashboard/admin/settings",
    label: "Policy settings",
    description: "Loan limit, due period, fine rates, reminder lead days and sender identity.",
    icon: <Settings />,
  },
  {
    href: "/dashboard/admin/email",
    label: "E-mail centre",
    description: "Reminder journal, delivery counters and the manual sweep.",
    icon: <MailWarning />,
  },
  {
    href: "/dashboard/admin/logs",
    label: "Audit trail",
    description: "Every privileged action, newest first, with the recorded payload.",
    icon: <ScrollText />,
  },
  {
    href: "/dashboard/admin/branches",
    label: "Branches and categories",
    description: "The three RCC branches and the subject taxonomy behind the catalogue.",
    icon: <Building2 />,
  },
  {
    href: "/dashboard/inventory",
    label: "Inventory and copies",
    description: "Physical copies, shelf locations and condition at each branch.",
    icon: <Boxes />,
  },
  {
    href: "/dashboard/fines",
    label: "Fine management",
    description: "Settle or waive penalties; every waiver is written to the audit trail.",
    icon: <Calculator />,
  },
  {
    href: "/dashboard/circulation",
    label: "Circulation desk",
    description: "Issue books by barcode or accession number.",
    icon: <Library />,
  },
];

export default async function AdminConsolePage() {
  const actor = await requireRole("admin");
  const [overview, demoCredentialsLive] = await Promise.all([getConsoleOverview(), seededAccountsPresent()]);
  const stats = overview.stats;
  const checks = buildHealthChecks();
  const degraded = checks.filter((check) => check.state !== "ready").length;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Administration"
        title="Admin console"
        description="The state of the whole library system in one screen: collection and circulation vitals, who holds which role, whether the integrations are wired, and what the desk and the reminder job did recently."
        actions={
          <>
            <Badge variant="gold" className="gap-1.5">
              <ShieldCheck className="size-3.5" />
              {actor.user.full_name}
            </Badge>
            <Badge variant={degraded === 0 ? "success" : "warning"} className="gap-1.5">
              <PlugZap className="size-3.5" />
              {degraded === 0 ? "All integrations ready" : `${degraded} integration(s) incomplete`}
            </Badge>
          </>
        }
      />

      <DemoCredentialWarning show={demoCredentialsLive} />

      {!stats ? (
        <Alert variant="destructive">
          <Database className="size-4" />
          <AlertTitle>dashboard_stats() returned nothing</AlertTitle>
          <AlertDescription>
            The counters view is unreadable — usually because the migrations have not been applied to
            this project yet. Run <code className="font-mono text-[11px]">supabase db push</code> and
            reload this page.
          </AlertDescription>
        </Alert>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Collection and circulation vitals">
        <StatTile
          label="Catalogued titles"
          value={formatNumber(stats?.total_books ?? 0)}
          hint={`${formatNumber(stats?.total_copies ?? 0)} physical copies tracked`}
          icon={<Library />}
          href="/dashboard/inventory"
        />
        <StatTile
          label="On the shelf"
          value={formatNumber(stats?.available_copies ?? 0)}
          hint={`${formatNumber(stats?.borrowed_copies ?? 0)} out · ${formatNumber(stats?.reserved_copies ?? 0)} reserved`}
          icon={<Boxes />}
          tone="success"
        />
        <StatTile
          label="Active loans"
          value={formatNumber(stats?.active_loans ?? 0)}
          hint={`${formatNumber(stats?.new_titles_30d ?? 0)} title(s) added in 30 days`}
          icon={<Users />}
        />
        <StatTile
          label="Overdue now"
          value={formatNumber(stats?.overdue_loans ?? 0)}
          hint={
            (stats?.damaged_copies ?? 0) + (stats?.lost_copies ?? 0) > 0
              ? `${formatNumber(stats?.damaged_copies ?? 0)} damaged · ${formatNumber(stats?.lost_copies ?? 0)} lost`
              : "No damaged or lost copies"
          }
          icon={<AlertTriangle />}
          tone={(stats?.overdue_loans ?? 0) > 0 ? "danger" : "success"}
          href="/dashboard/fines"
        />
        <StatTile
          label="Unsettled penalties"
          value={formatPeso(stats?.outstanding_fines ?? 0)}
          hint={`${formatPeso(stats?.collected_fines ?? 0)} collected to date · ${formatNumber(overview.pendingFineCount)} pending entr(ies)`}
          icon={<CircleDollarSign />}
          tone={(stats?.outstanding_fines ?? 0) > 0 ? "warning" : "success"}
          href="/dashboard/fines"
        />
        <StatTile
          label="Accounts held at desk"
          value={formatNumber(overview.blockedAccounts)}
          hint={`${formatNumber(stats?.total_borrowers ?? 0)} borrower(s) of ${formatNumber(stats?.registered_users ?? 0)} account(s)`}
          icon={<ShieldCheck />}
          tone={overview.blockedAccounts > 0 ? "warning" : "default"}
          href="/dashboard/members"
        />
        <StatTile
          label="Messages queued"
          value={formatNumber(overview.emails.queued)}
          hint={`${formatNumber(overview.emails.sent)} sent · ${formatNumber(overview.emails.failed)} failed · ${formatNumber(overview.emails.skipped)} skipped`}
          icon={<MailWarning />}
          tone={overview.emails.queued > 0 ? "warning" : "default"}
          href="/dashboard/admin/email"
        />
        <StatTile
          label="Audit entries (24 h)"
          value={formatNumber(overview.auditLast24h)}
          hint={`${formatNumber(stats?.open_reservations ?? 0)} hold(s) waiting on the shelf`}
          icon={<Clock />}
          href="/dashboard/admin/logs"
        />
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <AccountRolesCard
          roleCounts={overview.roleCounts}
          activeAccounts={overview.activeAccounts}
          inactiveAccounts={overview.inactiveAccounts}
        />
        <IntegrationHealth checks={checks} />
        <AdminQuickLinks links={QUICK_LINKS} />
      </div>

      <ConsoleActivity
        recentAudit={overview.recentAudit}
        recentEmails={overview.recentEmails}
        auditLast24h={overview.auditLast24h}
      />

      <Card className="surface-card">
        <CardHeader>
          <CardTitle>Reading these figures</CardTitle>
          <CardDescription>
            Every number on this screen is computed by Postgres, not by the browser.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 text-xs leading-relaxed text-muted-foreground sm:grid-cols-2">
          <p>
            Collection and circulation counts come from the <code className="font-mono">dashboard_stats()</code> RPC,
            the same source the member overview uses, so the desk and this console can never disagree.
          </p>
          <p>
            Role counts read <code className="font-mono">user_roles</code> directly: the console keeps one primary
            role per account, and changing it revokes the previous grant in the same transaction.
          </p>
          <p>
            The e-mail counters and the audit feed are read from <code className="font-mono">email_logs</code> and{" "}
            <code className="font-mono">audit_logs</code>, both of which row-level security restricts to
            administrators — a librarian signing in sees nothing here.
          </p>
          <p>
            Overdue figures refresh when the reminder job runs, either on the schedule or from the button in the
            e-mail centre; <code className="font-mono">mark_overdue_loans()</code> is what flips a late loan.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
