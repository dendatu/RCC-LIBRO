import type { Metadata } from "next";
import Link from "next/link";
import { CircleSlash, Search, ShieldCheck, UserCog, Users } from "lucide-react";
import { UserManageDialog } from "@/components/admin/user-manage-dialog";
import { PageHeader } from "@/components/shell/page-header";
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
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ROLE_LABEL } from "@/lib/constants";
import { requireRole } from "@/lib/rbac";
import { formatDate, formatNumber } from "@/lib/utils";
import {
  listManagedUsers,
  memberClassification,
  relativeTime,
  type ManagedUser,
} from "@/server/data/admin";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Users and roles",
  description:
    "Assign librarian or administrator roles, classify borrowers and open or close accounts in the RCC library system.",
};

const PER_PAGE = 20;

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

function FilterSelect({
  name,
  value,
  label,
  children,
}: {
  name: string;
  value: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <select
      name={name}
      aria-label={label}
      defaultValue={value}
      className="h-9 rounded-lg border border-input bg-card px-3 text-sm text-foreground shadow-xs outline-none transition-[color,box-shadow,border-color] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/25"
    >
      {children}
    </select>
  );
}

export default async function AdminUsersPage({ searchParams }: { searchParams: SearchParams }) {
  const actor = await requireRole("admin");
  const params = await searchParams;

  const base = {
    q: single(params.q)?.trim() ?? "",
    role: single(params.role) ?? "",
    status: single(params.status) ?? "",
    page: single(params.page) ?? "",
  };

  const { rows, total, page } = await listManagedUsers({
    q: base.q || undefined,
    role: base.role || undefined,
    status: base.status || undefined,
    page: base.page ? Math.max(1, Number(base.page) || 1) : 1,
    perPage: PER_PAGE,
  });
  const pageCount = Math.max(1, Math.ceil(total / PER_PAGE));

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Administration"
        title="Users and roles"
        description="Every account in the system, its library role and its borrower classification. Roles decide what a person can do at the desk; classification decides what they may borrow."
        actions={
          <Badge variant="secondary" className="gap-1.5">
            <Users className="size-3.5" />
            {formatNumber(total)} account(s)
          </Badge>
        }
      />

      <Card className="border-gold/40 bg-gold-soft/25">
        <CardHeader>
          <CardTitle>Accounts are closed, never erased</CardTitle>
          <CardDescription>
            The console has no delete button. Loans, fines and SBTR history belong to an account
            forever, so an account leaving RCC is deactivated instead — it keeps its record, loses
            its sign-in. Your own account cannot be demoted or closed while you are signed in, and
            the last active administrator is always protected.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2 text-xs text-brand-800">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-card px-2.5 py-1">
            <ShieldCheck className="size-3.5" />
            {ROLE_LABEL.admin}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-card px-2.5 py-1">
            <UserCog className="size-3.5" />
            {ROLE_LABEL.librarian}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-card px-2.5 py-1">
            <Users className="size-3.5" />
            {ROLE_LABEL.borrower}
          </span>
        </CardContent>
      </Card>

      <form method="get" className="surface-card flex flex-wrap items-center gap-2 p-4">
        <div className="relative min-w-[14rem] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            name="q"
            defaultValue={base.q}
            placeholder="Search by name or e-mail…"
            aria-label="Search accounts"
            className="pl-9"
          />
        </div>

        <FilterSelect name="role" value={base.role} label="Filter by role">
          <option value="">All roles</option>
          <option value="borrower">Borrowers</option>
          <option value="librarian">Librarians</option>
          <option value="admin">Administrators</option>
        </FilterSelect>

        <FilterSelect name="status" value={base.status} label="Filter by account status">
          <option value="">Any standing</option>
          <option value="active">Active sign-in</option>
          <option value="inactive">Closed account</option>
        </FilterSelect>

        <Button type="submit">
          <Search className="size-4" />
          Apply
        </Button>
        <Button asChild variant="ghost">
          <Link href="/dashboard/admin/users">Reset</Link>
        </Button>
      </form>

      {rows.length === 0 ? (
        <EmptyState
          icon={<Users className="size-7" />}
          title="No account matches these filters"
          description="Clear the search or widen the role filter to see the whole register."
        />
      ) : (
        <div className="surface-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead scope="col">Account</TableHead>
                <TableHead scope="col">Role</TableHead>
                <TableHead scope="col">Classification</TableHead>
                <TableHead scope="col">Standing</TableHead>
                <TableHead scope="col" className="text-right">
                  Loans
                </TableHead>
                <TableHead scope="col">Last seen</TableHead>
                <TableHead scope="col" className="text-right">
                  Manage
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((user) => (
                <UserRow key={rowKey(user)} user={user} currentUserId={actor.user.id} />
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {pageCount > 1 ? (
        <nav className="flex items-center justify-center gap-3" aria-label="Account list pages">
          {page > 1 ? (
            <Button asChild size="sm" variant="outline">
              <Link href={`/dashboard/admin/users${buildQuery(base, { page: String(page - 1) })}`}>
                Previous
              </Link>
            </Button>
          ) : null}
          <p className="text-sm text-muted-foreground">
            Page {page} of {pageCount} · {formatNumber(total)} account(s)
          </p>
          {page < pageCount ? (
            <Button asChild size="sm" variant="outline">
              <Link href={`/dashboard/admin/users${buildQuery(base, { page: String(page + 1) })}`}>
                Next
              </Link>
            </Button>
          ) : null}
        </nav>
      ) : null}
    </div>
  );
}

/** Re-keys the dialog with fresh server data after every successful mutation. */
function rowKey(user: ManagedUser) {
  return [
    user.id,
    user.roles.join("-"),
    user.is_active ? "on" : "off",
    user.profile?.borrower_type ?? "-",
    user.profile?.education_level ?? "-",
    user.profile?.college_program ?? "-",
    user.profile?.faculty_department ?? "-",
    user.profile?.sbtr_number ?? "-",
    user.record?.borrowing_limit ?? "-",
  ].join("|");
}

function UserRow({ user, currentUserId }: { user: ManagedUser; currentUserId: string }) {
  const isSelf = user.id === currentUserId;

  return (
    <TableRow>
      <TableCell>
        <p className="font-medium text-ink">
          {user.full_name}
          {isSelf ? (
            <span className="ml-2 align-middle text-[11px] font-semibold text-brand-500">
              you
            </span>
          ) : null}
        </p>
        <p className="truncate text-xs text-muted-foreground">{user.email}</p>
        <p className="text-[11px] text-muted-foreground">Joined {formatDate(user.created_at)}</p>
      </TableCell>
      <TableCell>
        <div className="flex flex-wrap gap-1">
          {user.roles.length === 0 ? (
            <Badge variant="outline">No role</Badge>
          ) : (
            user.roles.map((role) => (
              <Badge
                key={role}
                variant={role === "admin" ? "default" : role === "librarian" ? "info" : "secondary"}
              >
                {ROLE_LABEL[role]}
              </Badge>
            ))
          )}
        </div>
      </TableCell>
      <TableCell>
        <p className="text-sm text-ink-soft">{memberClassification(user.profile)}</p>
        <p className="font-mono text-[11px] text-muted-foreground">
          {user.profile?.sbtr_number ?? "no SBTR"}
        </p>
      </TableCell>
      <TableCell>
        <div className="flex flex-wrap items-center gap-1">
          {user.is_active ? (
            <Badge variant="success">Open</Badge>
          ) : (
            <Badge variant="outline">
              <CircleSlash className="size-3" />
              Closed
            </Badge>
          )}
          {user.record?.is_blocked ? <Badge variant="destructive">Held at desk</Badge> : null}
          {user.record ? (
            <span className="text-[11px] text-muted-foreground">{user.record.status}</span>
          ) : null}
        </div>
      </TableCell>
      <TableCell className="text-right tabular-nums text-sm">
        <p className="text-ink">{formatNumber(user.record?.active_loans ?? 0)} open</p>
        <p className={user.record?.overdue_loans ? "text-danger" : "text-muted-foreground"}>
          {formatNumber(user.record?.overdue_loans ?? 0)} late
        </p>
        <p className="text-[11px] text-muted-foreground">
          limit {formatNumber(user.record?.borrowing_limit ?? 0)}
        </p>
      </TableCell>
      <TableCell className="text-xs text-muted-foreground">
        {user.last_login_at ? relativeTime(user.last_login_at) : "Never signed in"}
      </TableCell>
      <TableCell className="text-right">
        <UserManageDialog user={user} currentUserId={currentUserId} />
      </TableCell>
    </TableRow>
  );
}
