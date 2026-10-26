import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight, ScanBarcode, Search, Users } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  BORROWER_TYPES,
  COLLEGE_PROGRAMS,
  EDUCATION_LEVELS,
  FACULTY_DEPARTMENTS,
} from "@/lib/constants";
import { requireRole } from "@/lib/rbac";
import { formatDate, formatPeso } from "@/lib/utils";
import {
  countMembers,
  listMembers,
  type MemberFilters,
} from "@/server/data/circulation";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Borrower records",
  description: "Standing, SBTR number, entitlement, open loans and outstanding penalties per member.",
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function single(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

const PER_PAGE = 25;

const STANDING_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "suspended", label: "Suspended" },
  { value: "graduated", label: "Graduated" },
  { value: "inactive", label: "Inactive" },
];

function selectClass() {
  return "h-11 w-full rounded-lg border border-input bg-card px-3 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/25";
}

export default async function MembersPage({ searchParams }: { searchParams: SearchParams }) {
  await requireRole("librarian", "admin");
  const params = await searchParams;

  const filters: MemberFilters = {
    q: single(params.q) ?? "",
    borrowerType: single(params.borrowerType) ?? "",
    educationLevel: single(params.educationLevel) ?? "",
    collegeProgram: single(params.collegeProgram) ?? "",
    facultyDepartment: single(params.facultyDepartment) ?? "",
    status: single(params.status) ?? "",
    blocked: single(params.blocked) ?? "",
    page: Math.max(1, Number(single(params.page) ?? "1") || 1),
    perPage: PER_PAGE,
  };

  const [rows, total] = await Promise.all([listMembers(filters), countMembers(filters)]);
  const pages = Math.max(1, Math.ceil(total / PER_PAGE));

  const href = (page: number) => {
    const query = new URLSearchParams();
    if (filters.q) query.set("q", filters.q);
    if (filters.borrowerType) query.set("borrowerType", filters.borrowerType);
    if (filters.educationLevel) query.set("educationLevel", filters.educationLevel);
    if (filters.collegeProgram) query.set("collegeProgram", filters.collegeProgram);
    if (filters.facultyDepartment) query.set("facultyDepartment", filters.facultyDepartment);
    if (filters.status) query.set("status", filters.status);
    if (filters.blocked) query.set("blocked", filters.blocked);
    if (page > 1) query.set("page", String(page));
    const suffix = query.toString();
    return `/dashboard/members${suffix ? `?${suffix}` : ""}`;
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Circulation desk"
        title="Borrower records"
        description="Every member entitled to borrow, across the elementary, high school and college libraries. Open a record to see the SBTR ledger, penalties and the staff edit form."
        actions={
          <Button asChild variant="outline">
            <Link href="/dashboard/circulation">
              <ScanBarcode className="size-4" /> Issue books
            </Link>
          </Button>
        }
      />

      <form method="get" action="/dashboard/members" className="surface-card space-y-4 p-4 sm:p-5">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-2 lg:col-span-2">
            <Label htmlFor="q">Name, e-mail, SBTR, card or ID number</Label>
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="q"
                name="q"
                defaultValue={filters.q}
                placeholder="e.g. SBTR-2026-0148"
                className="h-11 pl-9"
                maxLength={80}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="borrowerType">Borrower type</Label>
            <select
              id="borrowerType"
              name="borrowerType"
              defaultValue={filters.borrowerType}
              className={selectClass()}
            >
              <option value="">Any borrower type</option>
              {BORROWER_TYPES.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="status">Standing</Label>
            <select
              id="status"
              name="status"
              defaultValue={filters.status}
              className={selectClass()}
            >
              <option value="">Any standing</option>
              {STANDING_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="educationLevel">Level</Label>
            <select
              id="educationLevel"
              name="educationLevel"
              defaultValue={filters.educationLevel}
              className={selectClass()}
            >
              <option value="">Any level</option>
              {EDUCATION_LEVELS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="collegeProgram">Programme</Label>
            <select
              id="collegeProgram"
              name="collegeProgram"
              defaultValue={filters.collegeProgram}
              className={selectClass()}
            >
              <option value="">Any programme</option>
              {COLLEGE_PROGRAMS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="facultyDepartment">Faculty department</Label>
            <select
              id="facultyDepartment"
              name="facultyDepartment"
              defaultValue={filters.facultyDepartment}
              className={selectClass()}
            >
              <option value="">Any department</option>
              {FACULTY_DEPARTMENTS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="blocked">Desk hold</Label>
            <select
              id="blocked"
              name="blocked"
              defaultValue={filters.blocked}
              className={selectClass()}
            >
              <option value="">Held or clear</option>
              <option value="blocked">Held at the desk</option>
              <option value="clear">Clear to borrow</option>
            </select>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit">Filter records</Button>
          <Button asChild variant="ghost">
            <Link href="/dashboard/members">Reset</Link>
          </Button>
          <p className="text-xs text-muted-foreground">
            {total} member(s) match. Searching covers name, e-mail, SBTR, card and ID numbers.
          </p>
        </div>
      </form>

      {!rows.length ? (
        <EmptyState
          icon={<Users className="size-5" />}
          title="No member matches those filters"
          description="Widen the search, or check the spelling of the SBTR or card number."
        />
      ) : (
        <Table containerClassName="overflow-x-auto rounded-xl border border-border">
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-[16rem]">Member</TableHead>
              <TableHead className="min-w-[12rem]">Numbers</TableHead>
              <TableHead className="min-w-[11rem]">Standing</TableHead>
              <TableHead className="min-w-[10rem]">Loans</TableHead>
              <TableHead className="min-w-[10rem] text-right">Penalties</TableHead>
              <TableHead className="min-w-[9rem]">Record</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.user_id} className="align-top">
                <TableCell>
                  <Link
                    href={`/dashboard/members/${row.user_id}`}
                    className="font-medium text-ink underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {row.full_name}
                  </Link>
                  <p className="mt-0.5 text-xs text-ink-soft">{row.classification}</p>
                  <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{row.email}</p>
                </TableCell>
                <TableCell>
                  <p className="text-xs font-medium text-ink">{row.sbtr_number ?? "No SBTR"}</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    Card {row.card_number ?? "not issued"}
                  </p>
                  {row.profile?.id_number ? (
                    <p className="text-[11px] text-muted-foreground">ID {row.profile.id_number}</p>
                  ) : null}
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1.5">
                    <Badge variant={row.standing === "active" ? "success" : row.standing === "suspended" ? "destructive" : "secondary"}>
                      {row.standing}
                    </Badge>
                    {!row.is_active ? <Badge variant="outline">disabled</Badge> : null}
                    {row.is_blocked ? <Badge variant="destructive">held</Badge> : null}
                  </div>
                  {row.record?.block_reason ? (
                    <p className="mt-1 text-[11px] text-destructive">{row.record.block_reason}</p>
                  ) : null}
                </TableCell>
                <TableCell>
                  <p className="text-sm text-ink">
                    {row.active_loans} out
                    {row.record ? ` / ${row.record.borrowing_limit}` : ""}
                  </p>
                  {row.overdue_loans > 0 ? (
                    <p className="text-[11px] text-destructive">{row.overdue_loans} overdue</p>
                  ) : null}
                </TableCell>
                <TableCell className="text-right">
                  <p className={row.outstanding_fines > 0 ? "font-semibold text-destructive" : "text-ink"}>
                    {formatPeso(row.outstanding_fines)}
                  </p>
                </TableCell>
                <TableCell>
                  <p className="text-[11px] text-muted-foreground">
                    Member since {formatDate(row.member_since)}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Last seen {row.last_login_at ? formatDate(row.last_login_at) : "never"}
                  </p>
                  <Button asChild size="sm" variant="outline" className="mt-2">
                    <Link href={`/dashboard/members/${row.user_id}`}>Open record</Link>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {pages > 1 ? (
        <nav aria-label="Borrower pages" className="flex items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            Page {filters.page} of {pages}
          </p>
          <div className="flex gap-2">
            {Number(filters.page) > 1 ? (
              <Button asChild size="sm" variant="outline">
                <Link href={href(Number(filters.page) - 1)}>
                  <ChevronLeft className="size-3.5" /> Previous
                </Link>
              </Button>
            ) : null}
            {Number(filters.page) < pages ? (
              <Button asChild size="sm" variant="outline">
                <Link href={href(Number(filters.page) + 1)}>
                  Next <ChevronRight className="size-3.5" />
                </Link>
              </Button>
            ) : null}
          </div>
        </nav>
      ) : null}
    </div>
  );
}
