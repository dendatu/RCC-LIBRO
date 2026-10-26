import type { Metadata } from "next";
import Link from "next/link";
import { ScrollText, Search } from "lucide-react";
import { AuditMetadataDialog } from "@/components/admin/audit-metadata-dialog";
import { PageHeader } from "@/components/shell/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { requireRole } from "@/lib/rbac";
import { formatDateTime, formatNumber } from "@/lib/utils";
import { getAuditFilterOptions, listAuditLogs, relativeTime } from "@/server/data/admin";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Audit trail",
  description:
    "Every privileged action recorded by RCC LIBRO — who issued or checked in a book, who changed a role, a policy or a fine.",
};

const PER_PAGE = 25;

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
      className="h-9 max-w-[13rem] rounded-lg border border-input bg-card px-3 text-sm text-foreground shadow-xs outline-none transition-[color,box-shadow,border-color] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/25"
    >
      {children}
    </select>
  );
}

function shortId(value: string | null) {
  if (!value) return "—";
  return value.length > 10 ? `${value.slice(0, 8)}…` : value;
}

export default async function AdminLogsPage({ searchParams }: { searchParams: SearchParams }) {
  await requireRole("admin");
  const params = await searchParams;

  const base = {
    action: single(params.action) ?? "",
    entity: single(params.entity) ?? "",
    actor: single(params.actor) ?? "",
    from: single(params.from) ?? "",
    to: single(params.to) ?? "",
    page: single(params.page) ?? "",
  };

  const page = base.page ? Math.max(1, Number(base.page) || 1) : 1;

  const [options, result] = await Promise.all([
    getAuditFilterOptions(),
    listAuditLogs({
      action: base.action || undefined,
      entityType: base.entity || undefined,
      actorId: base.actor || undefined,
      from: base.from || undefined,
      to: base.to || undefined,
      page,
      perPage: PER_PAGE,
    }),
  ]);

  const pageCount = Math.max(1, Math.ceil(result.total / PER_PAGE));
  const filtered = Boolean(
    base.action || base.entity || base.actor || base.from || base.to,
  );

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Administration"
        title="Audit trail"
        description="Append-only record of privileged work: loans issued and returned, fines settled or waived, roles granted, policies changed and reminders run. Rows cannot be edited or deleted from the console."
        actions={
          <Badge variant="secondary" className="gap-1.5">
            <ScrollText className="size-3.5" />
            {formatNumber(result.total)} entr(ies)
          </Badge>
        }
      />

      <form method="get" className="surface-card flex flex-wrap items-center gap-2 p-4">
        <FilterSelect name="action" value={base.action} label="Filter by action">
          <option value="">Any action</option>
          {options.actions.map((action) => (
            <option key={action} value={action}>
              {action}
            </option>
          ))}
        </FilterSelect>

        <FilterSelect name="entity" value={base.entity} label="Filter by entity type">
          <option value="">Any entity</option>
          {options.entityTypes.map((entityType) => (
            <option key={entityType} value={entityType}>
              {entityType}
            </option>
          ))}
        </FilterSelect>

        <FilterSelect name="actor" value={base.actor} label="Filter by actor">
          <option value="">Any staff member</option>
          {options.actors.map((actor) => (
            <option key={actor.id} value={actor.id}>
              {actor.full_name}
            </option>
          ))}
        </FilterSelect>

        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
          From
          <Input type="date" name="from" defaultValue={base.from} className="h-9 w-36" />
        </label>
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
          To
          <Input type="date" name="to" defaultValue={base.to} className="h-9 w-36" />
        </label>

        <Button type="submit">
          <Search className="size-4" />
          Apply
        </Button>
        {filtered ? (
          <Button asChild variant="ghost">
            <Link href="/dashboard/admin/logs">Clear</Link>
          </Button>
        ) : null}
      </form>

      {result.rows.length === 0 ? (
        <EmptyState
          icon={<ScrollText className="size-7" />}
          title={filtered ? "No entry matches these filters" : "The audit trail is empty"}
          description={
            filtered
              ? "Widen the date range or clear the action filter to see more of the register."
              : "As soon as staff issue a loan, settle a fine or change a policy, the action appears here."
          }
        />
      ) : (
        <div className="surface-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead scope="col">When</TableHead>
                <TableHead scope="col">Actor</TableHead>
                <TableHead scope="col">Action</TableHead>
                <TableHead scope="col">Entity</TableHead>
                <TableHead scope="col" className="text-right">
                  Metadata
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {result.rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>
                    <p className="text-sm text-ink">{relativeTime(row.created_at)}</p>
                    <p className="whitespace-nowrap text-[11px] text-muted-foreground">
                      {formatDateTime(row.created_at)}
                    </p>
                  </TableCell>
                  <TableCell className="text-sm text-ink-soft">{row.actor_name ?? "System"}</TableCell>
                  <TableCell>
                    <span className="font-mono text-[11px] text-brand-700">{row.action}</span>
                  </TableCell>
                  <TableCell>
                    <p className="text-sm text-ink-soft">{row.entity_type}</p>
                    <p className="font-mono text-[11px] text-muted-foreground">
                      {shortId(row.entity_id)}
                    </p>
                  </TableCell>
                  <TableCell className="text-right">
                    <AuditMetadataDialog
                      action={row.action}
                      entityType={row.entity_type}
                      entityId={row.entity_id}
                      createdAt={row.created_at}
                      actorName={row.actor_name ?? "System"}
                      metadata={row.metadata}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {pageCount > 1 ? (
        <nav className="flex items-center justify-center gap-3" aria-label="Audit trail pages">
          {page > 1 ? (
            <Button asChild size="sm" variant="outline">
              <Link href={`/dashboard/admin/logs${buildQuery(base, { page: String(page - 1) })}`}>
                Previous
              </Link>
            </Button>
          ) : null}
          <p className="text-sm text-muted-foreground">
            Page {page} of {pageCount} · {formatNumber(result.total)} entr(ies)
          </p>
          {page < pageCount ? (
            <Button asChild size="sm" variant="outline">
              <Link href={`/dashboard/admin/logs${buildQuery(base, { page: String(page + 1) })}`}>
                Next
              </Link>
            </Button>
          ) : null}
        </nav>
      ) : null}
    </div>
  );
}
