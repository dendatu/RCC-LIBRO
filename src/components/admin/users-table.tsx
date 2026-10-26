import Link from "next/link";
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
import { UserManageDialog, type UserRowData } from "@/components/admin/user-manage-dialog";
import { ROLE_LABEL } from "@/lib/constants";
import type { RoleSlug } from "@/lib/types";
import { formatDateTime } from "@/lib/utils";
import { memberClassification, relativeTime, type ManagedUser } from "@/server/data/admin";
import { buildQuery } from "@/components/admin/list-tools";

const ROLE_TONE: Record<RoleSlug, "gold" | "info" | "secondary"> = {
  admin: "gold",
  librarian: "info",
  borrower: "secondary",
};

function primaryRoleOf(user: ManagedUser): RoleSlug {
  if (user.roles.includes("admin")) return "admin";
  if (user.roles.includes("librarian")) return "librarian";
  return "borrower";
}

function toRowData(user: ManagedUser): UserRowData {
  return {
    id: user.id,
    full_name: user.full_name,
    email: user.email,
    is_active: user.is_active,
    created_at: user.created_at,
    last_login_at: user.last_login_at,
    roles: user.roles,
    profile: user.profile,
    record: user.record,
  };
}

/**
 * Register of every account. Row actions are the client dialog (role, activation,
 * classification) while the name links to the read-only standing sheet, so a
 * supervisor can inspect an account without editing anything.
 */
export function UsersTable({
  rows,
  currentUserId,
  basePath,
  query,
}: {
  rows: ManagedUser[];
  currentUserId: string;
  basePath: string;
  query: Record<string, string>;
}) {
  if (rows.length === 0) {
    return (
      <EmptyState
        title="No account matches those filters"
        description="Clear the search or switch the role back to “All roles” to see the full register."
      />
    );
  }

  return (
    <div className="surface-card overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead scope="col">Member</TableHead>
            <TableHead scope="col">Role</TableHead>
            <TableHead scope="col">Status</TableHead>
            <TableHead scope="col">Classification</TableHead>
            <TableHead scope="col">Standing</TableHead>
            <TableHead scope="col">Last sign-in</TableHead>
            <TableHead scope="col" className="text-right">
              Actions
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((user) => {
            const role = primaryRoleOf(user);
            const isSelf = user.id === currentUserId;
            return (
              <TableRow key={user.id} className={isSelf ? "bg-cream/60" : undefined}>
                <TableCell>
                  <p className="font-medium text-ink">
                    <Link
                      href={`${basePath}${buildQuery(query, { user: user.id })}`}
                      className="underline-offset-4 hover:underline"
                    >
                      {user.full_name}
                    </Link>
                    {isSelf ? (
                      <span className="ml-2 text-[11px] font-semibold uppercase tracking-wide text-brand-600">
                        you
                      </span>
                    ) : null}
                  </p>
                  <p className="max-w-56 truncate text-xs text-muted-foreground">{user.email}</p>
                </TableCell>
                <TableCell>
                  <Badge variant={ROLE_TONE[role]}>{ROLE_LABEL[role]}</Badge>
                  {user.roles.length > 1 ? (
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      also {user.roles.filter((item) => item !== role).map((item) => ROLE_LABEL[item]).join(", ")}
                    </p>
                  ) : null}
                </TableCell>
                <TableCell>
                  {user.is_active ? (
                    <Badge variant="success">Active</Badge>
                  ) : (
                    <Badge variant="destructive">Deactivated</Badge>
                  )}
                  {user.record ? (
                    <p className="mt-1 text-[11px] capitalize text-muted-foreground">
                      ledger: {user.record.status.replace(/_/g, " ")}
                    </p>
                  ) : null}
                </TableCell>
                <TableCell className="text-sm text-ink-soft">
                  {memberClassification(user.profile)}
                  {user.profile?.sbtr_number ? (
                    <p className="font-mono text-[11px] text-muted-foreground">{user.profile.sbtr_number}</p>
                  ) : (
                    <p className="text-[11px] text-muted-foreground">No SBTR number yet</p>
                  )}
                </TableCell>
                <TableCell className="text-sm">
                  {user.record ? (
                    <>
                      <span className="tabular-nums text-ink">
                        {user.record.active_loans}
                        <span className="text-muted-foreground"> / {user.record.borrowing_limit} out</span>
                      </span>
                      {user.record.overdue_loans > 0 || user.record.is_blocked ? (
                        <Badge variant="destructive" className="ml-2">
                          {user.record.is_blocked ? "Held" : `${user.record.overdue_loans} overdue`}
                        </Badge>
                      ) : null}
                    </>
                  ) : (
                    <span className="text-muted-foreground">Not a borrower</span>
                  )}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {user.last_login_at ? (
                    <>
                      <p>{relativeTime(user.last_login_at)}</p>
                      <p className="text-[11px]">{formatDateTime(user.last_login_at)}</p>
                    </>
                  ) : (
                    <p>Never signed in</p>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <UserManageDialog user={toRowData(user)} currentUserId={currentUserId} />
                  <Button asChild size="sm" variant="ghost">
                    <Link href={`${basePath}${buildQuery(query, { user: user.id })}`}>Standing</Link>
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
