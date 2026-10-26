import Link from "next/link";
import { ArrowRight, ShieldAlert, UserCog, Users, ShieldCheck } from "lucide-react";
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
import { ROLE_LABEL } from "@/lib/constants";
import type { RoleSlug } from "@/lib/types";
import { formatNumber } from "@/lib/utils";

/**
 * The demo seed (migration 00009) creates every account with one shared password.
 * Until those credentials are rotated the deployment is not go-live safe, so the
 * console says so on every visit instead of hiding it in a migration comment.
 */
export function DemoCredentialWarning({ show }: { show: boolean }) {
  if (!show) return null;

  return (
    <Alert variant="warning" className="border-warning/40">
      <ShieldAlert className="size-4" />
      <AlertTitle>Demo credentials are still live — rotate them before go-live</AlertTitle>
      <AlertDescription>
        <p className="leading-relaxed">
          Every seeded RCC account — all three branch librarians, the administrators and the sample
          borrowers — shares the password <code className="rounded bg-muted px-1 py-0.5 font-mono text-[11px]">RccLibrary#2026</code>.
          That is intentional for the walkthrough, but it means any reader of this repository can sign
          in as staff. Before the library goes live: reset each staff password (Supabase → Authentication
          → Users → “Send password recovery”), delete the sample borrowers that are not real students,
          and confirm the audit trail records the change.
        </p>
        <p className="mt-2 leading-relaxed">
          Loans, fines and notifications created by the seed are likewise real rows — clear them or
          mark them closed so the first live statistics are not polluted.
        </p>
      </AlertDescription>
    </Alert>
  );
}

export interface QuickLink {
  href: string;
  label: string;
  description: string;
  icon: React.ReactNode;
}

/** Hand-picked routes the administrator actually walks between during a shift. */
export function AdminQuickLinks({ links }: { links: QuickLink[] }) {
  return (
    <Card className="surface-card hover-lift">
      <CardHeader>
        <CardTitle>Jump to</CardTitle>
        <CardDescription>The screens a library administrator uses most.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-2">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="group flex items-start gap-3 rounded-lg border border-transparent px-2 py-2 transition-colors hover:border-brand-200 hover:bg-cream"
          >
            <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand-100 text-brand-700 [&_svg]:size-4">
              {link.icon}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-ink">{link.label}</span>
              <span className="block text-xs leading-relaxed text-muted-foreground">
                {link.description}
              </span>
            </span>
            <ArrowRight className="mt-1 size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-brand-700" />
          </Link>
        ))}
        <Button asChild variant="ghost" size="sm" className="mt-1 justify-start">
          <Link href="/dashboard/analytics">Open the analytics dashboard</Link>
        </Button>
      </CardContent>
    </Card>
  );
}

const ROLE_ORDER: RoleSlug[] = ["admin", "librarian", "borrower"];
const ROLE_BAR: Record<RoleSlug, string> = {
  admin: "bg-gold",
  librarian: "bg-info",
  borrower: "bg-brand-300",
};

/**
 * Accounts grouped by the role that decides what a person may do at the desk.
 * Counts come from `user_roles`, so a person holding two roles is counted in both
 * and the sum can exceed the number of accounts — stated here so the figure is
 * never misread.
 */
export function AccountRolesCard({
  roleCounts,
  activeAccounts,
  inactiveAccounts,
}: {
  roleCounts: Record<RoleSlug, number>;
  activeAccounts: number;
  inactiveAccounts: number;
}) {
  const largest = Math.max(1, ...ROLE_ORDER.map((role) => roleCounts[role] ?? 0));

  return (
    <Card className="surface-card hover-lift">
      <CardHeader>
        <CardTitle>Accounts by role</CardTitle>
        <CardDescription>
          {formatNumber(activeAccounts)} open sign-in(s), {formatNumber(inactiveAccounts)} closed.
          Role grants are exclusive in practice: the console keeps one primary role per account.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {ROLE_ORDER.map((role) => {
          const count = roleCounts[role] ?? 0;
          return (
            <div key={role} className="flex flex-col gap-1.5">
              <div className="flex items-baseline justify-between gap-2">
                <span className="flex items-center gap-1.5 text-sm font-semibold text-ink">
                  {role === "borrower" ? (
                    <Users className="size-3.5 text-muted-foreground" />
                  ) : role === "librarian" ? (
                    <UserCog className="size-3.5 text-muted-foreground" />
                  ) : (
                    <ShieldCheck className="size-3.5 text-muted-foreground" />
                  )}
                  {ROLE_LABEL[role]}
                </span>
                <Link
                  href={`/dashboard/admin/users?role=${role}`}
                  className="text-xs font-medium text-brand-700 underline-offset-4 hover:underline"
                >
                  {formatNumber(count)} account(s)
                </Link>
              </div>
              <div
                role="img"
                aria-label={`${ROLE_LABEL[role]}: ${count} account(s)`}
                className="h-2 overflow-hidden rounded-full bg-cream-dark"
              >
                <div
                  className={`h-full rounded-full ${ROLE_BAR[role]}`}
                  style={{ width: `${Math.round((count / largest) * 100)}%` }}
                />
              </div>
            </div>
          );
        })}

        <div className="flex flex-wrap items-center gap-2 pt-1">
          {roleCounts.admin > 0 ? (
            <Badge variant="gold">{roleCounts.admin} administrator(s)</Badge>
          ) : (
            <Badge variant="destructive">No administrator — the console is unreachable</Badge>
          )}
          {roleCounts.librarian > 0 ? (
            <Badge variant="info">{roleCounts.librarian} librarian(s)</Badge>
          ) : (
            <Badge variant="warning">No librarian at the desk</Badge>
          )}
          <Badge variant="secondary">{formatNumber(roleCounts.borrower)} borrower(s)</Badge>
        </div>
      </CardContent>
    </Card>
  );
}
