import Link from "next/link";
import { ArrowRight, Mail, ScrollText } from "lucide-react";
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
import type { AuditLogRow, EmailLogRow } from "@/lib/types";
import { relativeTime } from "@/server/data/admin";

const EMAIL_TONE: Record<EmailLogRow["status"], "success" | "warning" | "destructive" | "info" | "outline"> = {
  sent: "success",
  queued: "info",
  skipped: "warning",
  failed: "destructive",
  bounced: "destructive",
};

/**
 * The two journals an administrator is judged by: what staff did, and what the
 * system told borrowers. Both are read from the admin-only tables, so a librarian
 * signing in never reaches this panel.
 */
export function ConsoleActivity({
  recentAudit,
  recentEmails,
  auditLast24h,
}: {
  recentAudit: AuditLogRow[];
  recentEmails: EmailLogRow[];
  auditLast24h: number;
}) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card className="surface-card">
        <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <CardTitle>Latest privileged actions</CardTitle>
            <CardDescription>
              {auditLast24h > 0
                ? `${auditLast24h} entr${auditLast24h === 1 ? "y" : "ies"} written in the last 24 hours.`
                : "Nothing has been recorded in the last 24 hours."}
            </CardDescription>
          </div>
          <Button asChild variant="ghost" size="sm">
            <Link href="/dashboard/admin/logs">
              Audit trail <ArrowRight />
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          {recentAudit.length === 0 ? (
            <EmptyState
              icon={<ScrollText className="size-6" />}
              title="No activity yet"
              description="Loans, fine settlements, role changes and policy saves all land here."
            />
          ) : (
            <ul className="divide-y divide-border">
              {recentAudit.map((row) => (
                <li key={row.id} className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="font-mono text-[11px] font-semibold text-brand-700">{row.action}</span>
                    <span className="text-[11px] text-muted-foreground">{relativeTime(row.created_at)}</span>
                  </div>
                  <p className="text-xs text-ink-soft">
                    {row.actor_name ?? "System"} · {row.entity_type}
                    {row.entity_id ? ` · ${row.entity_id.slice(0, 8)}…` : ""}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card className="surface-card">
        <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <CardTitle>Recent borrower notices</CardTitle>
            <CardDescription>
              Due reminders and overdue notices staged by the scheduled job.
            </CardDescription>
          </div>
          <Button asChild variant="ghost" size="sm">
            <Link href="/dashboard/admin/email">
              E-mail centre <ArrowRight />
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          {recentEmails.length === 0 ? (
            <EmptyState
              icon={<Mail className="size-6" />}
              title="No message journaled yet"
              description="Run the reminder job from the e-mail centre and the first rows appear here."
            />
          ) : (
            <ul className="divide-y divide-border">
              {recentEmails.map((row) => (
                <li key={row.id} className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium text-ink">{row.recipient}</span>
                    <Badge variant={EMAIL_TONE[row.status] ?? "outline"}>{row.status}</Badge>
                  </div>
                  <p className="truncate text-xs text-muted-foreground" title={row.subject}>
                    {row.template} · {row.subject}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {row.sent_at ? `Sent ${relativeTime(row.sent_at)}` : `Queued ${relativeTime(row.queued_at)}`}
                    {row.error ? ` · ${row.error}` : ""}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
