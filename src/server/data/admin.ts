import "server-only";
import { formatDistanceToNowStrict } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { classificationLabel } from "@/lib/constants";
import type {
  AccountStatus,
  AuditLogRow,
  BookCategory,
  BorrowerRecord,
  DashboardStats,
  EmailLogRow,
  Library,
  LibraryUsageRow,
  MemberProfile,
  RoleSlug,
  SettingRow,
  TrendPoint,
} from "@/lib/types";

/** Windows offered by the trend switch on the analytics dashboard. */
export const TREND_WINDOWS = [7, 30, 90] as const;
export type TrendWindow = (typeof TREND_WINDOWS)[number];

export function resolveTrendWindow(value: string | string[] | undefined): TrendWindow {
  const raw = Array.isArray(value) ? value[0] : value;
  const parsed = Number(raw);
  return (TREND_WINDOWS as readonly number[]).includes(parsed)
    ? (parsed as TrendWindow)
    : 30;
}

const num = (value: unknown) => Number(value ?? 0);
const str = (value: unknown) => (value == null ? "" : String(value));

// ---------------------------------------------------------------------------
// Analytics RPCs
// ---------------------------------------------------------------------------

export async function getDashboardStats(): Promise<DashboardStats | null> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("dashboard_stats");
  if (!data) return null;
  const raw = data as Record<string, unknown>;
  return {
    total_books: num(raw.total_books),
    total_copies: num(raw.total_copies),
    available_copies: num(raw.available_copies),
    borrowed_copies: num(raw.borrowed_copies),
    reserved_copies: num(raw.reserved_copies),
    damaged_copies: num(raw.damaged_copies),
    lost_copies: num(raw.lost_copies),
    overdue_loans: num(raw.overdue_loans),
    active_loans: num(raw.active_loans),
    total_borrowers: num(raw.total_borrowers),
    registered_users: num(raw.registered_users),
    collected_fines: num(raw.collected_fines),
    outstanding_fines: num(raw.outstanding_fines),
    open_reservations: num(raw.open_reservations),
    new_titles_30d: num(raw.new_titles_30d),
  };
}

export async function getBorrowingTrends(days: TrendWindow = 30): Promise<TrendPoint[]> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("borrowing_trends", { p_days: days });
  return ((data ?? []) as Record<string, unknown>[]).map((row) => ({
    bucket: str(row.bucket),
    loans: num(row.loans),
    returns: num(row.returns),
  }));
}

export interface PopularBookRow {
  book_id: string;
  title: string;
  author: string;
  loans: number;
  library_name: string;
}

export async function getPopularBooks(limit = 8): Promise<PopularBookRow[]> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("popular_books", { p_limit: limit });
  return ((data ?? []) as Record<string, unknown>[]).map((row) => ({
    book_id: str(row.book_id),
    title: str(row.title),
    author: str(row.author),
    loans: num(row.loans),
    library_name: str(row.library_name),
  }));
}

export interface CategoryLoanRow {
  category: string;
  loans: number;
  titles: number;
}

export async function getPopularCategories(limit = 6): Promise<CategoryLoanRow[]> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("popular_categories", { p_limit: limit });
  return ((data ?? []) as Record<string, unknown>[]).map((row) => ({
    category: str(row.category),
    loans: num(row.loans),
    titles: num(row.titles),
  }));
}

export async function getBranchUsage(): Promise<LibraryUsageRow[]> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("branch_usage");
  return ((data ?? []) as Record<string, unknown>[]).map((row) => ({
    library_id: num(row.library_id),
    library: str(row.library),
    titles: num(row.titles),
    copies: num(row.copies),
    active_loans: num(row.active_loans),
    overdue: num(row.overdue),
  }));
}

export interface ActiveBorrowerRow {
  user_id: string;
  full_name: string;
  classification: string;
  loans: number;
  overdue: number;
}

export async function getMostActiveBorrowers(limit = 10): Promise<ActiveBorrowerRow[]> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("most_active_borrowers", { p_limit: limit });
  return ((data ?? []) as Record<string, unknown>[]).map((row) => ({
    user_id: str(row.user_id),
    full_name: str(row.full_name),
    classification: str(row.classification),
    loans: num(row.loans),
    overdue: num(row.overdue),
  }));
}

// ---------------------------------------------------------------------------
// Admin console overview
// ---------------------------------------------------------------------------

export interface EmailCounters {
  queued: number;
  sent: number;
  failed: number;
  skipped: number;
  bounced: number;
}

export interface ConsoleOverview {
  stats: DashboardStats | null;
  roleCounts: Record<RoleSlug, number>;
  activeAccounts: number;
  inactiveAccounts: number;
  pendingFineCount: number;
  blockedAccounts: number;
  emails: EmailCounters;
  auditLast24h: number;
  recentAudit: AuditLogRow[];
  recentEmails: EmailLogRow[];
}

async function countRows(
  supabase: Awaited<ReturnType<typeof createClient>>,
  table: string,
  filter: { column: string; operator: "eq" | "gte"; value: unknown },
): Promise<number> {
  const base = supabase.from(table).select("id", { count: "exact", head: true });
  const query =
    filter.operator === "gte"
      ? base.gte(filter.column, filter.value as string)
      : base.eq(filter.column, filter.value as never);
  const { count } = await query;
  return count ?? 0;
}

export async function getConsoleOverview(): Promise<ConsoleOverview> {
  const supabase = await createClient();
  const dayAgo = new Date(Date.now() - 86_400_000).toISOString();

  const [
    stats,
    roles,
    activeAccounts,
    inactiveAccounts,
    pendingFineCount,
    blockedAccounts,
    queued,
    sent,
    failed,
    skipped,
    bounced,
    auditLast24h,
    recentAuditRes,
    recentEmailsRes,
  ] = await Promise.all([
    getDashboardStats(),
    supabase.from("user_roles").select("role_slug"),
    countRows(supabase, "users", { column: "is_active", operator: "eq", value: true }),
    countRows(supabase, "users", { column: "is_active", operator: "eq", value: false }),
    countRows(supabase, "fines", { column: "status", operator: "eq", value: "pending" }),
    countRows(supabase, "borrower_records", { column: "is_blocked", operator: "eq", value: true }),
    countRows(supabase, "email_logs", { column: "status", operator: "eq", value: "queued" }),
    countRows(supabase, "email_logs", { column: "status", operator: "eq", value: "sent" }),
    countRows(supabase, "email_logs", { column: "status", operator: "eq", value: "failed" }),
    countRows(supabase, "email_logs", { column: "status", operator: "eq", value: "skipped" }),
    countRows(supabase, "email_logs", { column: "status", operator: "eq", value: "bounced" }),
    countRows(supabase, "audit_logs", { column: "created_at", operator: "gte", value: dayAgo }),
    supabase
      .from("audit_logs")
      .select("id, action, entity_type, entity_id, metadata, created_at, actor:users!actor_id(full_name)")
      .gte("created_at", dayAgo)
      .order("created_at", { ascending: false })
      .limit(6),
    supabase
      .from("email_logs")
      .select("*")
      .order("queued_at", { ascending: false })
      .limit(6),
  ]);

  const roleCounts: Record<RoleSlug, number> = { borrower: 0, librarian: 0, admin: 0 };
  for (const row of (roles.data ?? []) as { role_slug: string }[]) {
    const slug = row.role_slug as RoleSlug;
    if (slug in roleCounts) roleCounts[slug] += 1;
  }

  const auditRows = (recentAuditRes.data ?? []) as unknown as (Omit<
    AuditLogRow,
    "actor_name"
  > & { actor: { full_name: string } | null })[];

  return {
    stats,
    roleCounts,
    activeAccounts,
    inactiveAccounts,
    pendingFineCount,
    blockedAccounts,
    emails: { queued, sent, failed, skipped, bounced },
    auditLast24h,
    recentAudit: auditRows.map(({ actor, ...row }) => ({
      ...row,
      actor_name: actor?.full_name ?? "System",
    })),
    recentEmails: (recentEmailsRes.data ?? []) as EmailLogRow[],
  };
}

// ---------------------------------------------------------------------------
// Users & roles
// ---------------------------------------------------------------------------

export interface ManagedUser {
  id: string;
  full_name: string;
  email: string;
  is_active: boolean;
  created_at: string;
  last_login_at: string | null;
  roles: RoleSlug[];
  profile: MemberProfile | null;
  record: BorrowerRecord | null;
}

export interface UserListFilters {
  q?: string;
  role?: string;
  status?: string;
  page?: number;
  perPage?: number;
}

export interface UserListResult {
  rows: ManagedUser[];
  total: number;
  page: number;
  perPage: number;
}

export async function listManagedUsers(filters: UserListFilters = {}): Promise<UserListResult> {
  const supabase = await createClient();
  const page = Math.max(1, filters.page ?? 1);
  const perPage = Math.min(50, Math.max(10, filters.perPage ?? 20));
  const q = (filters.q ?? "").trim();
  const status = filters.status ?? "";

  const buildQuery = (selection: string, withCount: boolean) => {
    let query = supabase
      .from("users")
      .select(selection, withCount ? { count: "exact" } : undefined)
      .order("full_name");
    if (q) {
      const safe = q.replace(/[%_]/g, "");
      query = query.or(`full_name.ilike.%${safe}%,email.ilike.%${safe}%`);
    }
    if (status === "active") query = query.eq("is_active", true);
    if (status === "inactive") query = query.eq("is_active", false);
    return query;
  };

  const role = filters.role ?? "";
  const staffRole =
    role === "borrower" || role === "librarian" || role === "admin" ? role : null;

  // `!inner` makes the nested filter restrict the parent rows; every role of the
  // returned members is re-read below so the console still shows multi-role staff.
  // `user_roles` has two foreign keys into `users` (user_id and granted_by), so
  // the embed has to name the one it means or PostgREST answers PGRST201 and the
  // console renders an empty register.
  const selection = staffRole
    ? "id, full_name, email, is_active, created_at, last_login_at, profiles (*), borrower_records (*), user_roles!inner!user_roles_user_id_fkey(role_slug)"
    : "id, full_name, email, is_active, created_at, last_login_at, profiles (*), borrower_records (*), user_roles!user_roles_user_id_fkey(role_slug)";

  let pageQuery = buildQuery(selection, true);
  if (staffRole) pageQuery = pageQuery.eq("user_roles.role_slug", staffRole);

  const { data, count } = await pageQuery.range((page - 1) * perPage, page * perPage - 1);
  const rows = (data ?? []) as unknown as Record<string, unknown>[];
  const total = count ?? rows.length;

  const ids = rows.map((row) => str(row.id));
  const rolesById = new Map<string, RoleSlug[]>();
  if (staffRole && ids.length) {
    const { data: allRoles } = await supabase
      .from("user_roles")
      .select("user_id, role_slug")
      .in("user_id", ids);
    for (const item of (allRoles ?? []) as { user_id: string; role_slug: string }[]) {
      const list = rolesById.get(item.user_id) ?? [];
      list.push(item.role_slug as RoleSlug);
      rolesById.set(item.user_id, list);
    }
  }

  const mapped = rows.map((row) => {
    const embedded = (row.user_roles ?? []) as { role_slug: string }[];
    return {
      id: str(row.id),
      full_name: str(row.full_name),
      email: str(row.email),
      is_active: Boolean(row.is_active),
      created_at: str(row.created_at),
      last_login_at: row.last_login_at ? str(row.last_login_at) : null,
      roles:
        rolesById.get(str(row.id)) ?? embedded.map((item) => item.role_slug as RoleSlug),
      profile: (row.profiles ?? null) as MemberProfile | null,
      record: (row.borrower_records ?? null) as BorrowerRecord | null,
    } satisfies ManagedUser;
  });

  return { rows: mapped, total, page, perPage };
}

// ---------------------------------------------------------------------------
// Audit trail
// ---------------------------------------------------------------------------

export interface AuditFilters {
  action?: string;
  entityType?: string;
  actorId?: string;
  from?: string;
  to?: string;
  page?: number;
  perPage?: number;
}

export interface AuditListResult {
  rows: AuditLogRow[];
  total: number;
  page: number;
  perPage: number;
}

export async function listAuditLogs(filters: AuditFilters = {}): Promise<AuditListResult> {
  const supabase = await createClient();
  const page = Math.max(1, filters.page ?? 1);
  const perPage = Math.min(100, Math.max(10, filters.perPage ?? 25));

  let query = supabase
    .from("audit_logs")
    .select("id, action, entity_type, entity_id, metadata, created_at, actor:users!actor_id(full_name)")
    .order("created_at", { ascending: false });

  if (filters.action) query = query.eq("action", filters.action);
  if (filters.entityType) query = query.eq("entity_type", filters.entityType);
  if (filters.actorId) query = query.eq("actor_id", filters.actorId);
  if (filters.from) query = query.gte("created_at", new Date(`${filters.from}T00:00:00`).toISOString());
  if (filters.to) query = query.lte("created_at", new Date(`${filters.to}T23:59:59`).toISOString());

  const { data, count } = await query.range((page - 1) * perPage, page * perPage - 1);

  const rows = ((data ?? []) as unknown as (Omit<AuditLogRow, "actor_name"> & {
    actor: { full_name: string } | null;
  })[]).map(({ actor, ...row }) => ({ ...row, actor_name: actor?.full_name ?? "System" }));

  return { rows, total: count ?? rows.length, page, perPage };
}

export async function getAuditFilterOptions(): Promise<{
  actions: string[];
  entityTypes: string[];
  actors: { id: string; full_name: string }[];
}> {
  const supabase = await createClient();
  const [logRows, actors] = await Promise.all([
    supabase.from("audit_logs").select("action, entity_type").order("created_at", { ascending: false }).limit(3000),
    getStaffDirectory(),
  ]);
  const actions = new Set<string>();
  const entityTypes = new Set<string>();
  for (const row of (logRows.data ?? []) as { action: string; entity_type: string }[]) {
    actions.add(row.action);
    entityTypes.add(row.entity_type);
  }
  return {
    actions: [...actions].sort(),
    entityTypes: [...entityTypes].sort(),
    actors,
  };
}

export async function getStaffDirectory(): Promise<{ id: string; full_name: string }[]> {
  const supabase = await createClient();
  const { data: roleRows } = await supabase
    .from("user_roles")
    .select("user_id")
    .in("role_slug", ["librarian", "admin"]);
  const ids = [...new Set((roleRows ?? []).map((row: { user_id: string }) => row.user_id))];
  if (!ids.length) return [];
  const { data } = await supabase
    .from("users")
    .select("id, full_name")
    .in("id", ids)
    .order("full_name");
  return ((data ?? []) as { id: string; full_name: string }[]).map((row) => ({
    id: row.id,
    full_name: row.full_name,
  }));
}

/**
 * Writes through the `write_audit()` RPC so the actor is resolved by Postgres.
 * Falls back to a direct insert if the function is not executable by the
 * session role, so a privileged action is never left unlogged.
 */
export async function writeAudit(
  entry: { action: string; entityType: string; entityId?: string | null; metadata?: Record<string, unknown> },
): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("write_audit", {
    p_action: entry.action,
    p_entity_type: entry.entityType,
    p_entity_id: entry.entityId ?? null,
    p_metadata: entry.metadata ?? {},
  });
  if (error) {
    await supabase.from("audit_logs").insert({
      action: entry.action,
      entity_type: entry.entityType,
      entity_id: entry.entityId ?? null,
      metadata: entry.metadata ?? {},
    });
  }
}

// ---------------------------------------------------------------------------
// E-mail journal
// ---------------------------------------------------------------------------

/**
 * `email_logs` carries the idempotency guard and the provider message id.
 * `types.ts` models the delivery half only, so the journal view widens it here.
 */
export interface EmailLogDetail extends EmailLogRow {
  dedupe_key: string | null;
  user_id: string | null;
  provider_id: string | null;
  borrow_transaction_id: string | null;
}

export interface EmailListResult {
  rows: EmailLogDetail[];
  total: number;
  page: number;
  perPage: number;
}

export async function listEmailLogs(
  filters: { status?: string; template?: string; page?: number; perPage?: number } = {},
): Promise<EmailListResult> {
  const supabase = await createClient();
  const page = Math.max(1, filters.page ?? 1);
  const perPage = Math.min(100, Math.max(10, filters.perPage ?? 25));

  let query = supabase
    .from("email_logs")
    .select("*", { count: "exact" })
    .order("queued_at", { ascending: false });

  if (filters.status) query = query.eq("status", filters.status);
  if (filters.template) query = query.eq("template", filters.template);

  const { data, count } = await query.range((page - 1) * perPage, page * perPage - 1);
  return {
    rows: (data ?? []) as EmailLogDetail[],
    total: count ?? 0,
    page,
    perPage,
  };
}

export async function getEmailCounters(): Promise<EmailCounters> {
  const supabase = await createClient();
  const statuses: (keyof EmailCounters)[] = ["queued", "sent", "failed", "skipped", "bounced"];
  const results = await Promise.all(
    statuses.map((status) =>
      supabase.from("email_logs").select("id", { count: "exact", head: true }).eq("status", status),
    ),
  );
  const counters = { queued: 0, sent: 0, failed: 0, skipped: 0, bounced: 0 } as EmailCounters;
  statuses.forEach((status, index) => {
    counters[status] = results[index].count ?? 0;
  });
  return counters;
}

export async function getEmailTemplateOptions(): Promise<string[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("email_logs").select("template").order("template").limit(2000);
  return [...new Set(((data ?? []) as { template: string }[]).map((row) => row.template))].sort();
}

// ---------------------------------------------------------------------------
// Policy settings
// ---------------------------------------------------------------------------

export const SETTING_KEYS = {
  maxBooks: "borrowing.student.max_books",
  loanDays: "borrowing.student.duration_days",
  finePerDay: "borrowing.fine.per_day",
  reserveFinePerHour: "borrowing.fine.reserve_per_hour",
  reserveMinutes: "borrowing.reserve.duration_minutes",
  reserveTakeHomeHour: "borrowing.reserve.takehome_hour",
  fineBlockThreshold: "borrowing.block_on_unresolved_fines",
  reminderDays: "notifications.reminder_days",
  referenceLibraryOnly: "borrowing.reference.library_only",
  periodicalsLibraryOnly: "borrowing.periodicals.library_only",
  senderName: "notifications.sender_name",
  senderEmail: "notifications.sender_email",
  institution: "system.institution",
  currency: "system.currency",
} as const;

export type SettingKey = (typeof SETTING_KEYS)[keyof typeof SETTING_KEYS];

export interface SettingsFormValues {
  maxBooks: number;
  loanDays: number;
  finePerDay: number;
  reserveFinePerHour: number;
  reserveMinutes: number;
  reserveTakeHomeHour: number;
  fineBlockThreshold: number;
  reminderDays: number[];
  referenceLibraryOnly: boolean;
  periodicalsLibraryOnly: boolean;
  senderName: string;
  senderEmail: string;
  institution: string;
  currency: string;
}

export const SETTINGS_META: Record<
  SettingKey,
  { group: string; label: string; description: string; unit?: string }
> = {
  [SETTING_KEYS.maxBooks]: {
    group: "circulation",
    label: "Maximum borrowed books",
    description: "Students may hold at most this many books at one time.",
    unit: "books",
  },
  [SETTING_KEYS.loanDays]: {
    group: "circulation",
    label: "Loan period (days)",
    description: "Default due date offset for general collection loans.",
    unit: "days",
  },
  [SETTING_KEYS.finePerDay]: {
    group: "fines",
    label: "Overdue fine per day (PHP)",
    description: "Charged per book, per calendar day including weekends and holidays.",
    unit: "PHP",
  },
  [SETTING_KEYS.reserveFinePerHour]: {
    group: "fines",
    label: "Reserve book fine per hour (PHP)",
    description: "Charged when a reserve book is kept past its allowed window.",
    unit: "PHP",
  },
  [SETTING_KEYS.reserveMinutes]: {
    group: "circulation",
    label: "Reserve book in-library hours (minutes)",
    description: "Reserve books are for one hour of in-library use.",
    unit: "minutes",
  },
  [SETTING_KEYS.reserveTakeHomeHour]: {
    group: "circulation",
    label: "Reserve take-home hour (24h)",
    description: "From this hour a reserve book may be taken home and returned the next school day.",
    unit: "hour",
  },
  [SETTING_KEYS.fineBlockThreshold]: {
    group: "fines",
    label: "Fine threshold that blocks borrowing (PHP)",
    description: "Borrowing is refused when unresolved penalties meet or exceed this amount.",
    unit: "PHP",
  },
  [SETTING_KEYS.reminderDays]: {
    group: "notifications",
    label: "Due-date reminder lead times",
    description: "Days before the due date at which reminder e-mails are sent.",
  },
  [SETTING_KEYS.referenceLibraryOnly]: {
    group: "circulation",
    label: "Reference section is library use only",
    description: "Dictionaries, encyclopedias and atlases cannot leave the library.",
  },
  [SETTING_KEYS.periodicalsLibraryOnly]: {
    group: "circulation",
    label: "Periodicals are library use only",
    description: "Magazines, newspapers, journals and clippings cannot be borrowed.",
  },
  [SETTING_KEYS.senderName]: {
    group: "notifications",
    label: "Notification sender name",
    description: "Display name used in outgoing e-mail.",
  },
  [SETTING_KEYS.senderEmail]: {
    group: "notifications",
    label: "Notification sender e-mail",
    description: "Reply-to address for notification e-mail.",
  },
  [SETTING_KEYS.institution]: {
    group: "general",
    label: "Institution name",
    description: "Shown across printed reports.",
  },
  [SETTING_KEYS.currency]: {
    group: "general",
    label: "Currency",
    description: "Fines are recorded in this currency.",
  },
};

const readNumber = (value: unknown, fallback: number) => {
  const parsed = typeof value === "string" ? Number(value) : value;
  return typeof parsed === "number" && Number.isFinite(parsed) ? parsed : fallback;
};

const readBoolean = (value: unknown, fallback: boolean) =>
  typeof value === "boolean" ? value : fallback;

const readString = (value: unknown, fallback: string) =>
  typeof value === "string" && value.trim() ? value : fallback;

export interface SettingsBundle {
  rows: SettingRow[];
  values: SettingsFormValues;
  grouped: { group: string; rows: SettingRow[] }[];
}

export async function getSettingsBundle(): Promise<SettingsBundle> {
  const supabase = await createClient();
  const { data } = await supabase.from("settings").select("*").order("group_name").order("key");
  const rows = ((data ?? []) as unknown as Record<string, unknown>[]).map((row) => ({
    key: str(row.key),
    value: row.value,
    label: str(row.label),
    description: row.description ? str(row.description) : null,
    group_name: str(row.group_name) || "general",
    updated_at: str(row.updated_at),
  })) satisfies SettingRow[];

  const byKey = new Map(rows.map((row) => [row.key, row.value]));
  const get = <T>(key: SettingKey, fallback: T): T => {
    const value = byKey.get(key);
    return value === undefined ? fallback : (value as T);
  };

  const reminderRaw = byKey.get(SETTING_KEYS.reminderDays);
  const reminderDays = Array.isArray(reminderRaw)
    ? reminderRaw.map((item) => Number(item)).filter((item) => Number.isFinite(item))
    : [7, 3, 1];

  const values: SettingsFormValues = {
    maxBooks: readNumber(get(SETTING_KEYS.maxBooks, 3), 3),
    loanDays: readNumber(get(SETTING_KEYS.loanDays, 7), 7),
    finePerDay: readNumber(get(SETTING_KEYS.finePerDay, 1), 1),
    reserveFinePerHour: readNumber(get(SETTING_KEYS.reserveFinePerHour, 2), 2),
    reserveMinutes: readNumber(get(SETTING_KEYS.reserveMinutes, 60), 60),
    reserveTakeHomeHour: readNumber(get(SETTING_KEYS.reserveTakeHomeHour, 16), 16),
    fineBlockThreshold: readNumber(get(SETTING_KEYS.fineBlockThreshold, 100), 100),
    reminderDays: reminderDays.length ? reminderDays : [7, 3, 1],
    referenceLibraryOnly: readBoolean(get(SETTING_KEYS.referenceLibraryOnly, true), true),
    periodicalsLibraryOnly: readBoolean(get(SETTING_KEYS.periodicalsLibraryOnly, true), true),
    senderName: readString(get(SETTING_KEYS.senderName, "RCC LIBRO"), "RCC LIBRO"),
    senderEmail: readString(get(SETTING_KEYS.senderEmail, "library@rcc.edu.ph"), "library@rcc.edu.ph"),
    institution: readString(get(SETTING_KEYS.institution, ""), ""),
    currency: readString(get(SETTING_KEYS.currency, "PHP"), "PHP"),
  };

  const groups = ["circulation", "fines", "notifications", "general"];
  const grouped = groups
    .map((group) => ({ group, rows: rows.filter((row) => row.group_name === group) }))
    .filter((entry) => entry.rows.length > 0);

  return { rows, values, grouped };
}

// ---------------------------------------------------------------------------
// Branches & categories
// ---------------------------------------------------------------------------

export async function listLibraries(): Promise<Library[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("libraries").select("*").order("sort_order").order("name");
  return ((data ?? []) as unknown as Record<string, unknown>[]).map(
    (row) =>
      ({
        id: num(row.id),
        code: str(row.code),
        name: str(row.name),
        description: row.description ? str(row.description) : null,
        address: row.address ? str(row.address) : null,
        contact_number: row.contact_number ? str(row.contact_number) : null,
        email: row.email ? str(row.email) : null,
        is_active: Boolean(row.is_active),
        sort_order: num(row.sort_order),
      }) satisfies Library,
  );
}

export async function listCategories(): Promise<BookCategory[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("book_categories")
    .select("*")
    .order("sort_order")
    .order("name");
  return ((data ?? []) as unknown as Record<string, unknown>[]).map(
    (row) =>
      ({
        id: num(row.id),
        name: str(row.name),
        slug: str(row.slug),
        description: row.description ? str(row.description) : null,
        parent_id: row.parent_id == null ? null : num(row.parent_id),
        sort_order: num(row.sort_order),
        is_active: Boolean(row.is_active),
      }) satisfies BookCategory,
  );
}

/** Title counts per branch/category for the management screens. */
export async function getCollectionCounts(): Promise<{
  booksByLibrary: Record<string, number>;
  booksByCategory: Record<string, number>;
}> {
  const supabase = await createClient();
  const { data } = await supabase.from("books").select("library_id, category_id");
  const booksByLibrary: Record<string, number> = {};
  const booksByCategory: Record<string, number> = {};
  for (const row of (data ?? []) as { library_id: number | string; category_id: number | string | null }[]) {
    const libraryKey = String(row.library_id);
    booksByLibrary[libraryKey] = (booksByLibrary[libraryKey] ?? 0) + 1;
    if (row.category_id != null) {
      const categoryKey = String(row.category_id);
      booksByCategory[categoryKey] = (booksByCategory[categoryKey] ?? 0) + 1;
    }
  }
  return { booksByLibrary, booksByCategory };
}

// ---------------------------------------------------------------------------
// Presentation helpers shared by the admin screens
// ---------------------------------------------------------------------------

export function memberClassification(profile: MemberProfile | null): string {
  if (!profile) return "Unclassified member";
  return classificationLabel(profile);
}

export const ACCOUNT_STATUS_LABEL: Record<AccountStatus, string> = {
  active: "Active",
  suspended: "Suspended",
  graduated: "Graduated",
  inactive: "Inactive",
};

export function relativeTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return `${formatDistanceToNowStrict(date)} ago`;
}

export function shortTitle(value: string, max = 28): string {
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1).trimEnd()}…`;
}
