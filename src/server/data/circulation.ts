import "server-only";

import { classificationLabel } from "@/lib/constants";
import { createClient } from "@/lib/supabase/server";
import { daysUntil } from "@/lib/utils";
import type {
  AccountStatus,
  BorrowStatus,
  BorrowerRecord,
  CirculationSection,
  CopyStatus,
  Fine,
  FineStatus,
  MemberProfile,
  ReservationStatus,
  RoleSlug,
  SbtrRow,
} from "@/lib/types";

const LOAN_EMBED = `
  id, reference_no, borrower_id, book_id, copy_id, status, section, source, notes,
  date_borrowed, due_date, date_returned, renewals_used, max_renewals, sbtr_number,
  is_overdue, overdue_days, fine_charged,
  borrower:users!borrow_transactions_borrower_id_fkey(
    id, full_name, email,
    profile:profiles!profiles_user_id_fkey(card_number, borrower_type, education_level, senior_high_track, college_program, faculty_department, section)
  ),
  book:books!borrow_transactions_book_id_fkey(id, title, author, accession_number, call_number),
  copy:book_copies!borrow_transactions_copy_id_fkey(id, barcode, condition, shelf_location),
  library:libraries!borrow_transactions_library_id_fkey(id, name, code)
`;

const COPY_EMBED = `
  id, barcode, accession_number, copy_number, status, condition, shelf_location,
  acquisition_price, is_library_use_only, notes,
  book:books!book_copies_book_id_fkey(
    id, title, author, accession_number, call_number, section, total_copies, available_copies, is_published,
    library:libraries!books_library_id_fkey(name, code)
  )
`;

const FINE_EMBED = `
  *,
  borrower:users!fines_borrower_id_fkey(
    id, full_name, email,
    profile:profiles!profiles_user_id_fkey(
      borrower_type, education_level, senior_high_track, college_program, faculty_department, section, sbtr_number, card_number
    )
  ),
  book:books!fines_book_id_fkey(id, title, accession_number),
  transaction:borrow_transactions!fines_borrow_transaction_id_fkey(reference_no)
`;

export interface DeskCopy {
  copy_id: string;
  barcode: string;
  accession_number: string | null;
  copy_number: number;
  status: CopyStatus;
  condition: string;
  shelf_location: string | null;
  acquisition_price: number | null;
  is_library_use_only: boolean;
  notes: string | null;
  book_id: string;
  title: string;
  author: string;
  book_accession: string;
  call_number: string;
  section: CirculationSection;
  library_name: string;
  total_copies: number;
  available_copies: number;
  is_published: boolean;
}

export interface BorrowerOption {
  user_id: string;
  full_name: string;
  email: string;
  is_active: boolean;
  borrower_type: string | null;
  classification: string;
  sbtr_number: string | null;
  card_number: string | null;
  id_number: string | null;
  status: AccountStatus;
  borrowing_limit: number;
  active_loans: number;
  overdue_loans: number;
  outstanding_fines: number;
  total_loans: number;
  is_blocked: boolean;
  block_reason: string | null;
}

export interface DeskLoan {
  id: string;
  reference_no: string;
  borrower_id: string;
  borrower_name: string;
  borrower_email: string;
  borrower_card: string | null;
  classification: string;
  book_id: string;
  book_title: string;
  book_author: string;
  accession_number: string;
  call_number: string;
  barcode: string | null;
  library_name: string;
  status: BorrowStatus;
  section: CirculationSection;
  date_borrowed: string;
  due_date: string;
  date_returned: string | null;
  renewals_used: number;
  max_renewals: number;
  sbtr_number: string | null;
  is_overdue: boolean;
  overdue_days: number;
  fine_charged: number;
  days_left: number;
}

export interface FineRow extends Fine {
  borrower_name: string;
  borrower_email: string;
  borrower_card: string | null;
  sbtr_number: string | null;
  classification: string;
  book_title: string | null;
  reference_no: string | null;
}

export interface EligibilityResult {
  eligible: boolean;
  reasons: { code: string; message: string }[];
  active_loans: number;
  borrowing_limit: number;
  outstanding_fines: number;
}

export interface LostCopyRow {
  copy_id: string;
  barcode: string;
  status: CopyStatus;
  condition: string;
  shelf_location: string | null;
  acquisition_price: number | null;
  title: string;
  author: string;
  accession_number: string;
  section: CirculationSection;
  library_name: string;
  borrower_name: string | null;
  reference_no: string | null;
  fine_amount: number;
  fine_status: FineStatus | null;
  fine_type: string | null;
}

export interface MemberRow {
  user_id: string;
  full_name: string;
  email: string;
  contact_number: string | null;
  is_active: boolean;
  last_login_at: string | null;
  member_since: string;
  profile: MemberProfile | null;
  record: BorrowerRecord | null;
  classification: string;
  sbtr_number: string | null;
  card_number: string | null;
  active_loans: number;
  overdue_loans: number;
  outstanding_fines: number;
  is_blocked: boolean;
  standing: AccountStatus;
}

export interface QueueRow {
  id: string;
  book_id: string;
  book_title: string;
  book_author: string;
  accession_number: string;
  cover_image_url: string | null;
  section: CirculationSection;
  available_copies: number;
  total_copies: number;
  borrower_id: string;
  borrower_name: string;
  borrower_email: string;
  sbtr_number: string | null;
  status: ReservationStatus;
  queue_position: number;
  requested_at: string;
  ready_at: string | null;
  held_until: string | null;
  copy_barcode: string | null;
  notes: string | null;
}

export interface ReportRow {
  id: string;
  reference_no: string;
  borrower_name: string;
  borrower_email: string;
  sbtr_number: string | null;
  book_title: string;
  book_author: string;
  accession_number: string;
  call_number: string;
  barcode: string | null;
  library_name: string;
  librarian_name: string | null;
  section: CirculationSection;
  status: BorrowStatus;
  date_borrowed: string;
  due_date: string;
  date_returned: string | null;
  overdue_days: number;
  fine_charged: number;
}

export interface MemberFilters {
  q?: string;
  borrowerType?: string;
  educationLevel?: string;
  collegeProgram?: string;
  facultyDepartment?: string;
  status?: string;
  blocked?: string;
  page?: number;
  perPage?: number;
}

function sanitizeTerm(value: string) {
  return value.replace(/[%,()"']/g, " ").replace(/\s+/g, " ").trim();
}

/** Scanners post the full QR payload; the desk only needs the copy barcode. */
export function normalizeScanTerm(raw: string) {
  const value = raw.trim();
  if (!value) return "";
  const embedded = value.match(/(?:rcc-libro:\/\/copy\/|\/book\/)([^/?#]+)/i);
  if (embedded) return decodeURIComponent(embedded[1]).trim();
  return value;
}

function toNumber(value: unknown) {
  return Number(value ?? 0);
}

function mapCopy(row: Record<string, unknown> | null): DeskCopy | null {
  if (!row) return null;
  const book = (row.book ?? null) as Record<string, unknown> | null;
  if (!book) return null;
  const library = (book.library ?? null) as { name?: string } | null;
  return {
    copy_id: String(row.id),
    barcode: String(row.barcode ?? ""),
    accession_number: (row.accession_number as string | null) ?? null,
    copy_number: toNumber(row.copy_number),
    status: row.status as CopyStatus,
    condition: String(row.condition ?? "Good"),
    shelf_location: (row.shelf_location as string | null) ?? null,
    acquisition_price: row.acquisition_price === null ? null : toNumber(row.acquisition_price),
    is_library_use_only: Boolean(row.is_library_use_only),
    notes: (row.notes as string | null) ?? null,
    book_id: String(book.id),
    title: String(book.title ?? ""),
    author: String(book.author ?? ""),
    book_accession: String(book.accession_number ?? ""),
    call_number: String(book.call_number ?? ""),
    section: book.section as CirculationSection,
    library_name: library?.name ?? "RCC Library",
    total_copies: toNumber(book.total_copies),
    available_copies: toNumber(book.available_copies),
    is_published: Boolean(book.is_published),
  };
}

function mapLoan(row: Record<string, unknown>): DeskLoan {
  const borrower = (row.borrower ?? {}) as Record<string, unknown>;
  const profile = (borrower.profile ?? {}) as Record<string, unknown>;
  const book = (row.book ?? {}) as Record<string, unknown>;
  const copy = (row.copy ?? {}) as Record<string, unknown>;
  const library = (row.library ?? {}) as { name?: string };
  return {
    id: String(row.id),
    reference_no: String(row.reference_no ?? ""),
    borrower_id: String(row.borrower_id),
    borrower_name: String(borrower.full_name ?? "Unknown borrower"),
    borrower_email: String(borrower.email ?? ""),
    borrower_card: (profile.card_number as string | null) ?? null,
    classification: classificationLabel(profile as Parameters<typeof classificationLabel>[0]),
    book_id: String(row.book_id),
    book_title: String(book.title ?? ""),
    book_author: String(book.author ?? ""),
    accession_number: String(book.accession_number ?? ""),
    call_number: String(book.call_number ?? ""),
    barcode: (copy.barcode as string | null) ?? null,
    library_name: library.name ?? "—",
    status: row.status as BorrowStatus,
    section: row.section as CirculationSection,
    date_borrowed: String(row.date_borrowed),
    due_date: String(row.due_date),
    date_returned: (row.date_returned as string | null) ?? null,
    renewals_used: toNumber(row.renewals_used),
    max_renewals: toNumber(row.max_renewals),
    sbtr_number: (row.sbtr_number as string | null) ?? null,
    is_overdue: Boolean(row.is_overdue),
    overdue_days: toNumber(row.overdue_days),
    fine_charged: toNumber(row.fine_charged),
    days_left: daysUntil(String(row.due_date)),
  };
}

function mapFine(row: Record<string, unknown>): FineRow {
  const { borrower, book, transaction, ...fine } = row;
  const person = (borrower ?? {}) as Record<string, unknown>;
  const profile = (person.profile ?? {}) as Record<string, unknown>;
  const title = (book ?? null) as { title?: string } | null;
  const reference = (transaction ?? null) as { reference_no?: string } | null;
  return {
    ...(fine as unknown as Fine),
    borrower_name: String(person.full_name ?? "Unknown borrower"),
    borrower_email: String(person.email ?? ""),
    borrower_card: (profile.card_number as string | null) ?? null,
    sbtr_number: (profile.sbtr_number as string | null) ?? null,
    classification: classificationLabel(profile as Parameters<typeof classificationLabel>[0]),
    book_title: title?.title ?? null,
    reference_no: reference?.reference_no ?? null,
  };
}

export async function resolveDeskCopy(term: string): Promise<DeskCopy | null> {
  const value = normalizeScanTerm(term);
  if (!value) return null;
  const supabase = await createClient();

  const byBarcode = await supabase.from("book_copies").select(COPY_EMBED).eq("barcode", value).maybeSingle();
  if (byBarcode.data) return mapCopy(byBarcode.data as Record<string, unknown>);

  const byCopyAccession = await supabase
    .from("book_copies")
    .select(COPY_EMBED)
    .eq("accession_number", value)
    .maybeSingle();
  if (byCopyAccession.data) return mapCopy(byCopyAccession.data as Record<string, unknown>);

  const byBookAccession = await supabase.from("books").select("id").eq("accession_number", value).maybeSingle();
  if (!byBookAccession.data) return null;

  const bookId = String(byBookAccession.data.id);
  const free = await supabase
    .from("book_copies")
    .select(COPY_EMBED)
    .eq("book_id", bookId)
    .eq("status", "available")
    .order("copy_number")
    .limit(1)
    .maybeSingle();
  if (free.data) return mapCopy(free.data as Record<string, unknown>);

  const anyCopy = await supabase
    .from("book_copies")
    .select(COPY_EMBED)
    .eq("book_id", bookId)
    .order("copy_number")
    .limit(1)
    .maybeSingle();
  return mapCopy((anyCopy.data ?? null) as Record<string, unknown> | null);
}

export async function firstAvailableCopyBarcode(bookId: string): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("book_copies")
    .select("barcode")
    .eq("book_id", bookId)
    .eq("status", "available")
    .order("copy_number")
    .limit(1)
    .maybeSingle();
  return (data?.barcode as string | undefined) ?? null;
}

export async function evaluateEligibility(userId: string): Promise<EligibilityResult | null> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("evaluate_borrow_eligibility", { p_user_id: userId });
  if (!data) return null;
  const payload = data as Record<string, unknown>;
  return {
    eligible: Boolean(payload.eligible),
    reasons: Array.isArray(payload.reasons)
      ? (payload.reasons as Record<string, unknown>[]).map((reason) => ({
          code: String(reason.code ?? "reason"),
          message: String(reason.message ?? ""),
        }))
      : [],
    active_loans: toNumber(payload.active_loans),
    borrowing_limit: toNumber(payload.borrowing_limit),
    outstanding_fines: toNumber(payload.outstanding_fines),
  };
}

/** Due date computed by Postgres so the desk never re-implements the rule. */
export async function previewDueDate(section: CirculationSection, days?: number | null): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("compute_due_date", {
    p_section: section,
    p_days_override: days ? Math.round(days) : null,
  });
  return (data as string | null) ?? null;
}

export async function previewFine(
  section: CirculationSection,
  dueDate: string,
  asOf: string,
): Promise<number | null> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("calculate_fine", {
    p_section: section,
    p_due_date: dueDate,
    p_as_of: asOf,
  });
  if (data === null || data === undefined) return null;
  return toNumber(data);
}

export async function getLoan(transactionId: string): Promise<DeskLoan | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("borrow_transactions")
    .select(LOAN_EMBED)
    .eq("id", transactionId)
    .maybeSingle();
  return data ? mapLoan(data as Record<string, unknown>) : null;
}

async function loansQuery(
  builder: PromiseLike<{ data: unknown }>,
): Promise<DeskLoan[]> {
  const { data } = await builder;
  return ((data ?? []) as unknown as Record<string, unknown>[]).map(mapLoan);
}

function openLoans(supabase: Awaited<ReturnType<typeof createClient>>) {
  return supabase
    .from("borrow_transactions")
    .select(LOAN_EMBED)
    .in("status", ["active", "overdue"]);
}

export async function searchOpenLoans(term: string): Promise<DeskLoan[]> {
  const value = normalizeScanTerm(term);
  if (!value) return listOpenLoans(50);
  const supabase = await createClient();
  const clean = sanitizeTerm(value);

  if (/^RCC-\d{4}-\d{1,6}$/i.test(clean)) {
    return loansQuery(openLoans(supabase).ilike("reference_no", `%${clean}%`).order("due_date").limit(50));
  }

  const copy = await resolveDeskCopy(clean);
  if (copy) {
    return loansQuery(openLoans(supabase).eq("copy_id", copy.copy_id).order("due_date").limit(50));
  }

  const reference = await openLoans(supabase).ilike("reference_no", `%${clean}%`).order("due_date").limit(5);
  if ((reference.data ?? []).length > 0) {
    return ((reference.data ?? []) as unknown as Record<string, unknown>[]).map(mapLoan);
  }

  const { data: people } = await supabase
    .from("users")
    .select("id")
    .or(`full_name.ilike.%${clean}%,email.ilike.%${clean}%`)
    .limit(40);
  const ids = (people ?? []).map((row) => String(row.id));
  if (!ids.length) return [];
  return loansQuery(openLoans(supabase).in("borrower_id", ids).order("due_date").limit(50));
}

export async function listOpenLoans(limit = 80): Promise<DeskLoan[]> {
  const supabase = await createClient();
  return loansQuery(openLoans(supabase).order("due_date").limit(limit));
}

export async function listOverdueLoans(limit = 100): Promise<DeskLoan[]> {
  const supabase = await createClient();
  return loansQuery(
    openLoans(supabase).lt("due_date", new Date().toISOString()).order("due_date").limit(limit),
  );
}

export async function listDeskActivity(limit = 60): Promise<DeskLoan[]> {
  const supabase = await createClient();
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59, 999);

  const [issued, returned, dueToday] = await Promise.all([
    supabase
      .from("borrow_transactions")
      .select(LOAN_EMBED)
      .gte("date_borrowed", startOfDay.toISOString())
      .lte("date_borrowed", endOfDay.toISOString())
      .order("date_borrowed", { ascending: false })
      .limit(limit),
    supabase
      .from("borrow_transactions")
      .select(LOAN_EMBED)
      .gte("date_returned", startOfDay.toISOString())
      .lte("date_returned", endOfDay.toISOString())
      .order("date_returned", { ascending: false })
      .limit(limit),
    supabase
      .from("borrow_transactions")
      .select(LOAN_EMBED)
      .in("status", ["active", "overdue"])
      .gte("due_date", startOfDay.toISOString())
      .lte("due_date", endOfDay.toISOString())
      .order("due_date")
      .limit(limit),
  ]);

  const seen = new Set<string>();
  const rows: DeskLoan[] = [];
  for (const group of [issued.data, returned.data, dueToday.data]) {
    for (const raw of (group ?? []) as Record<string, unknown>[]) {
      const loan = mapLoan(raw);
      if (seen.has(loan.id)) continue;
      seen.add(loan.id);
      rows.push(loan);
    }
  }
  return rows;
}

export async function listLoansByBorrower(userId: string, includeClosed: boolean): Promise<DeskLoan[]> {
  const supabase = await createClient();
  const query = supabase
    .from("borrow_transactions")
    .select(LOAN_EMBED)
    .eq("borrower_id", userId)
    .order("date_borrowed", { ascending: false })
    .limit(60);
  if (!includeClosed) query.in("status", ["active", "overdue"]);
  return loansQuery(query);
}

export async function listLostAndDamaged(): Promise<LostCopyRow[]> {
  const supabase = await createClient();

  const [copiesRes, finesRes] = await Promise.all([
    supabase
      .from("book_copies")
      .select(COPY_EMBED)
      .in("status", ["lost", "damaged"])
      .order("updated_at", { ascending: false })
      .limit(80),
    supabase
      .from("fines")
      .select(
        `id, borrower_id, type, amount, status, created_at, borrow_transaction_id,
         borrower:users!fines_borrower_id_fkey(full_name),
         transaction:borrow_transactions!fines_borrow_transaction_id_fkey(copy_id, reference_no)`,
      )
      .in("type", ["lost_book", "damaged_book"])
      .order("created_at", { ascending: false })
      .limit(400),
  ]);

  const fineByCopy = new Map<string, Record<string, unknown>>();
  for (const raw of (finesRes.data ?? []) as unknown as Record<string, unknown>[]) {
    const transaction = (raw.transaction ?? null) as { copy_id?: string } | null;
    const copyId = transaction?.copy_id;
    if (copyId && !fineByCopy.has(String(copyId))) fineByCopy.set(String(copyId), raw);
  }

  return ((copiesRes.data ?? []) as unknown as Record<string, unknown>[])
    .map((raw) => {
      const copy = mapCopy(raw);
      if (!copy) return null;
      const fine = fineByCopy.get(copy.copy_id) ?? null;
      const borrower = (fine?.borrower ?? null) as { full_name?: string } | null;
      const transaction = (fine?.transaction ?? null) as { reference_no?: string } | null;
      return {
        copy_id: copy.copy_id,
        barcode: copy.barcode,
        status: copy.status,
        condition: copy.condition,
        shelf_location: copy.shelf_location,
        acquisition_price: copy.acquisition_price,
        title: copy.title,
        author: copy.author,
        accession_number: copy.book_accession,
        section: copy.section,
        library_name: copy.library_name,
        borrower_name: borrower?.full_name ?? null,
        reference_no: transaction?.reference_no ?? null,
        fine_amount: fine ? toNumber(fine.amount) : 0,
        fine_status: fine ? (fine.status as FineStatus) : null,
        fine_type: fine ? String(fine.type) : null,
      } satisfies LostCopyRow;
    })
    .filter((row): row is LostCopyRow => row !== null);
}

export async function listFines(options: { status?: FineStatus; borrowerId?: string; limit?: number } = {}) {
  const supabase = await createClient();
  let query = supabase.from("fines").select(FINE_EMBED);
  if (options.status) query = query.eq("status", options.status);
  if (options.borrowerId) query = query.eq("borrower_id", options.borrowerId);
  const { data } = await query
    .order("created_at", { ascending: false })
    .limit(options.limit ?? 200);
  return ((data ?? []) as Record<string, unknown>[]).map(mapFine);
}

export async function listFineTotals() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("fines")
    .select("status, amount")
    .limit(5000);
  const totals: Record<string, { count: number; amount: number }> = {};
  for (const row of (data ?? []) as { status: string; amount: number }[]) {
    const bucket = (totals[row.status] ??= { count: 0, amount: 0 });
    bucket.count += 1;
    bucket.amount += toNumber(row.amount);
  }
  return totals;
}

export async function listDebtors(limit = 40): Promise<
  { borrower_id: string; name: string; sbtr_number: string | null; total: number; items: number }[]
> {
  const rows = await listFines({ status: "pending", limit: 1000 });
  const grouped = new Map<string, { borrower_id: string; name: string; sbtr_number: string | null; total: number; items: number }>();
  for (const fine of rows) {
    const entry = grouped.get(fine.borrower_id) ?? {
      borrower_id: fine.borrower_id,
      name: fine.borrower_name,
      sbtr_number: null,
      total: 0,
      items: 0,
    };
    entry.total += toNumber(fine.amount);
    entry.items += 1;
    grouped.set(fine.borrower_id, entry);
  }
  return [...grouped.values()].sort((a, b) => b.total - a.total).slice(0, limit);
}

function mapMember(row: Record<string, unknown>): MemberRow {
  const user = (row.user ?? {}) as Record<string, unknown> & { profile?: MemberProfile };
  const profile = (user.profile ?? null) as MemberProfile | null;
  // Both callers select from `borrower_records` itself, so the row's own columns
  // are the record — there is no nested record to read.
  const record = row as unknown as BorrowerRecord;
  return {
    user_id: String(row.user_id),
    full_name: String(user.full_name ?? "Unnamed member"),
    email: String(user.email ?? ""),
    contact_number: (user.contact_number as string | null) ?? null,
    is_active: Boolean(user.is_active),
    last_login_at: (user.last_login_at as string | null) ?? null,
    member_since: String(user.created_at ?? row.created_at ?? ""),
    profile,
    record,
    classification: classificationLabel((profile ?? {}) as Parameters<typeof classificationLabel>[0]),
    sbtr_number: profile?.sbtr_number ?? null,
    card_number: profile?.card_number ?? null,
    active_loans: toNumber(record?.active_loans),
    overdue_loans: toNumber(record?.overdue_loans),
    outstanding_fines: toNumber(record?.outstanding_fines),
    is_blocked: Boolean(record?.is_blocked),
    standing: (record?.status ?? "active") as AccountStatus,
  };
}

function matchIds(term: string): Promise<string[]> {
  return (async () => {
    const supabase = await createClient();
    const clean = sanitizeTerm(term);
    if (!clean) return [];
    const like = `%${clean}%`;
    const [people, records] = await Promise.all([
      supabase.from("users").select("id").or(`full_name.ilike.${like},email.ilike.${like}`).limit(200),
      supabase
        .from("profiles")
        .select("user_id")
        .or(`sbtr_number.ilike.${like},card_number.ilike.${like},id_number.ilike.${like}`)
        .limit(200),
    ]);
    const ids = new Set<string>();
    for (const row of people.data ?? []) ids.add(String(row.id));
    for (const row of records.data ?? []) ids.add(String(row.user_id));
    return [...ids];
  })();
}

export async function countMembers(filters: MemberFilters): Promise<number> {
  const supabase = await createClient();
  let query = supabase.from("borrower_records").select("user_id", { count: "exact", head: true });
  if (filters.status) query = query.eq("status", filters.status);
  if (filters.blocked === "blocked") query = query.eq("is_blocked", true);
  if (filters.blocked === "clear") query = query.eq("is_blocked", false);

  const scoped = await memberScope(filters);
  if (scoped) query = query.in("user_id", scoped);

  const { count } = await query;
  return count ?? 0;
}

async function memberScope(filters: MemberFilters): Promise<string[] | null> {
  const needsProfile =
    Boolean(filters.q) ||
    Boolean(filters.borrowerType) ||
    Boolean(filters.educationLevel) ||
    Boolean(filters.collegeProgram) ||
    Boolean(filters.facultyDepartment);
  if (!needsProfile) return null;

  const supabase = await createClient();
  let query = supabase.from("profiles").select("user_id").limit(400);
  if (filters.borrowerType) query = query.eq("borrower_type", filters.borrowerType);
  if (filters.educationLevel) query = query.eq("education_level", filters.educationLevel);
  if (filters.collegeProgram) query = query.eq("college_program", filters.collegeProgram);
  if (filters.facultyDepartment) query = query.eq("faculty_department", filters.facultyDepartment);
  const { data } = await query;
  const scoped = (data ?? []).map((row) => String(row.user_id));

  if (!filters.q) return scoped;
  const matched = await matchIds(filters.q);
  if (!scoped.length) return matched;
  const set = new Set(scoped);
  return matched.filter((id) => set.has(id));
}

/**
 * `profiles` and `borrower_records` are siblings — both hang off `users`, never
 * off each other — so the profile has to be reached through the user embed.
 * Naming each foreign key is mandatory: `user_roles`-style ambiguity and
 * PostgREST's PGRST200 both answer with an error supabase-js hides, and the
 * console renders an empty list.
 */
const MEMBER_SELECT = `user_id, status, borrowing_limit, loan_period_days, active_loans, overdue_loans,
       outstanding_fines, total_loans, last_borrowed_at, is_blocked, block_reason, created_at,
       user:users!borrower_records_user_id_fkey(id, full_name, email, contact_number, is_active, last_login_at, created_at,
         profile:profiles!profiles_user_id_fkey(*))`;

export async function listMembers(filters: MemberFilters): Promise<MemberRow[]> {
  const supabase = await createClient();
  const perPage = filters.perPage ?? 25;
  const page = Math.max(1, filters.page ?? 1);

  let query = supabase.from("borrower_records").select(MEMBER_SELECT).order("user_id");

  if (filters.status) query = query.eq("status", filters.status);
  if (filters.blocked === "blocked") query = query.eq("is_blocked", true);
  if (filters.blocked === "clear") query = query.eq("is_blocked", false);

  const scoped = await memberScope(filters);
  if (scoped) {
    if (!scoped.length) return [];
    query = query.in("user_id", scoped);
  }

  const { data } = await query.range((page - 1) * perPage, page * perPage - 1);
  return ((data ?? []) as Record<string, unknown>[]).map(mapMember);
}

export async function getMemberDetail(userId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("borrower_records")
    .select(MEMBER_SELECT)
    .eq("user_id", userId)
    .maybeSingle();

  if (!data) return null;

  const [sbtr, fines, openLoans_, roles, eligibility] = await Promise.all([
    supabase
      .from("sbtr_view")
      .select("*")
      .eq("borrower_id", userId)
      .order("date_borrowed", { ascending: false })
      .limit(200),
    listFines({ borrowerId: userId, limit: 100 }),
    listLoansByBorrower(userId, false),
    supabase.from("user_roles").select("role_slug").eq("user_id", userId),
    evaluateEligibility(userId),
  ]);

  return {
    member: mapMember(data as Record<string, unknown>),
    sbtr: (sbtr.data ?? []) as unknown as SbtrRow[],
    fines,
    openLoans: openLoans_,
    roles: ((roles.data ?? []) as { role_slug: string }[]).map((row) => row.role_slug as RoleSlug),
    eligibility,
  };
}

export async function listReservationQueue(): Promise<QueueRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("reservations")
    .select(
      `id, book_id, borrower_id, status, queue_position, held_until, requested_at, ready_at, fulfilled_at, cancelled_at, notes,
       book:books!reservations_book_id_fkey(id, title, author, accession_number, cover_image_url, section, available_copies, total_copies),
       borrower:users!reservations_borrower_id_fkey(id, full_name, email,
         profile:profiles!profiles_user_id_fkey(sbtr_number)),
       copy:book_copies!reservations_copy_id_fkey(barcode)`,
    )
    .in("status", ["waiting", "ready"])
    .order("requested_at")
    .limit(300);

  const rows = ((data ?? []) as Record<string, unknown>[]).map((row) => {
    const book = (row.book ?? {}) as Record<string, unknown>;
    const borrower = (row.borrower ?? {}) as Record<string, unknown>;
    const profile = (borrower.profile ?? {}) as Record<string, unknown>;
    const copy = (row.copy ?? null) as { barcode?: string } | null;
    return {
      id: String(row.id),
      book_id: String(row.book_id),
      book_title: String(book.title ?? "Untitled"),
      book_author: String(book.author ?? ""),
      accession_number: String(book.accession_number ?? ""),
      cover_image_url: (book.cover_image_url as string | null) ?? null,
      section: book.section as CirculationSection,
      available_copies: toNumber(book.available_copies),
      total_copies: toNumber(book.total_copies),
      borrower_id: String(row.borrower_id),
      borrower_name: String(borrower.full_name ?? "Unknown borrower"),
      borrower_email: String(borrower.email ?? ""),
      sbtr_number: (profile.sbtr_number as string | null) ?? null,
      status: row.status as ReservationStatus,
      queue_position: toNumber(row.queue_position),
      requested_at: String(row.requested_at),
      ready_at: (row.ready_at as string | null) ?? null,
      held_until: (row.held_until as string | null) ?? null,
      copy_barcode: copy?.barcode ?? null,
      notes: (row.notes as string | null) ?? null,
    } satisfies QueueRow;
  });

  // The desk needs a scannable label for "issue to holder" even when the
  // borrower reserved the title rather than a specific copy.
  const barcodeByBook = new Map<string, string | null>();
  for (const row of rows) {
    if (row.copy_barcode || barcodeByBook.has(row.book_id)) continue;
    barcodeByBook.set(row.book_id, await firstAvailableCopyBarcode(row.book_id));
  }
  for (const row of rows) {
    if (!row.copy_barcode) row.copy_barcode = barcodeByBook.get(row.book_id) ?? null;
  }

  return rows;
}

export interface ReportInput {
  from?: string;
  to?: string;
  libraryId?: string;
}

export function resolveReportRange(input: ReportInput) {
  const to = input.to ? new Date(`${input.to}T23:59:59`) : new Date();
  const from = input.from
    ? new Date(`${input.from}T00:00:00`)
    : new Date(to.getTime() - 29 * 86_400_000);
  const safeFrom = Number.isNaN(from.getTime()) ? new Date(to.getTime() - 29 * 86_400_000) : from;
  const safeTo = Number.isNaN(to.getTime()) ? new Date() : to;
  return {
    from: safeFrom > safeTo ? safeTo : safeFrom,
    to: safeTo,
    fromValue: Number.isNaN(from.getTime()) ? "" : input.from ?? "",
    toValue: Number.isNaN(to.getTime()) ? "" : input.to ?? "",
  };
}

export async function listReportRows(input: ReportInput): Promise<ReportRow[]> {
  const supabase = await createClient();
  const { from, to } = resolveReportRange(input);

  let query = supabase
    .from("borrow_transactions")
    .select(
      `id, reference_no, borrower_id, book_id, copy_id, library_id, status, section,
       date_borrowed, due_date, date_returned, sbtr_number, overdue_days, fine_charged,
       borrower:users!borrow_transactions_borrower_id_fkey(full_name, email),
       book:books!borrow_transactions_book_id_fkey(title, author, accession_number, call_number),
       copy:book_copies!borrow_transactions_copy_id_fkey(barcode),
       librarian:users!borrow_transactions_librarian_id_fkey(full_name),
       library:libraries!borrow_transactions_library_id_fkey(name)`,
    )
    .gte("date_borrowed", from.toISOString())
    .lte("date_borrowed", to.toISOString())
    .order("date_borrowed", { ascending: false })
    .limit(2000);

  if (input.libraryId) query = query.eq("library_id", Number(input.libraryId));

  const { data } = await query;
  return ((data ?? []) as Record<string, unknown>[]).map((row) => {
    const borrower = (row.borrower ?? {}) as Record<string, unknown>;
    const book = (row.book ?? {}) as Record<string, unknown>;
    const copy = (row.copy ?? null) as { barcode?: string } | null;
    const librarian = (row.librarian ?? null) as { full_name?: string } | null;
    return {
      id: String(row.id),
      reference_no: String(row.reference_no ?? ""),
      borrower_name: String(borrower.full_name ?? ""),
      borrower_email: String(borrower.email ?? ""),
      sbtr_number: (row.sbtr_number as string | null) ?? null,
      book_title: String(book.title ?? ""),
      book_author: String(book.author ?? ""),
      accession_number: String(book.accession_number ?? ""),
      call_number: String(book.call_number ?? ""),
      barcode: copy?.barcode ?? null,
      library_name: String((row as { library?: { name?: string } }).library?.name ?? ""),
      librarian_name: librarian?.full_name ?? null,
      section: row.section as CirculationSection,
      status: row.status as BorrowStatus,
      date_borrowed: String(row.date_borrowed),
      due_date: String(row.due_date),
      date_returned: (row.date_returned as string | null) ?? null,
      overdue_days: toNumber(row.overdue_days),
      fine_charged: toNumber(row.fine_charged),
    } satisfies ReportRow;
  });
}

export function summariseReport(rows: ReportRow[]) {
  const now = Date.now();
  const returned = rows.filter((row) => row.date_returned).length;
  const overdue = rows.filter(
    (row) => row.status === "overdue" || (row.status === "active" && new Date(row.due_date).getTime() < now),
  ).length;
  const fines = rows.reduce((sum, row) => sum + toNumber(row.fine_charged), 0);
  const borrowers = new Set(rows.map((row) => row.borrower_name)).size;
  const byTitle = new Map<string, { title: string; author: string; loans: number }>();
  for (const row of rows) {
    const key = row.book_title;
    const entry = byTitle.get(key) ?? { title: key, author: row.book_author, loans: 0 };
    entry.loans += 1;
    byTitle.set(key, entry);
  }
  return {
    loans: rows.length,
    returned,
    outstanding: rows.length - returned,
    overdue,
    fines,
    borrowers,
    topTitles: [...byTitle.values()].sort((a, b) => b.loans - a.loans).slice(0, 8),
  };
}

export async function listBranches() {
  const supabase = await createClient();
  const { data } = await supabase.from("libraries").select("id, code, name, sort_order").order("sort_order");
  return (data ?? []) as { id: number; code: string; name: string; sort_order: number }[];
}

function mapBorrowerOption(row: Record<string, unknown>): BorrowerOption {
  const profile = (row.profile ?? null) as MemberProfile | null;
  const record = (row.record ?? null) as BorrowerRecord | null;
  return {
    user_id: String(row.id),
    full_name: String(row.full_name ?? "Unnamed member"),
    email: String(row.email ?? ""),
    is_active: Boolean(row.is_active),
    borrower_type: profile?.borrower_type ?? null,
    classification: classificationLabel((profile ?? {}) as Parameters<typeof classificationLabel>[0]),
    sbtr_number: profile?.sbtr_number ?? null,
    card_number: profile?.card_number ?? null,
    id_number: profile?.id_number ?? null,
    status: (record?.status ?? "active") as AccountStatus,
    borrowing_limit: toNumber(record?.borrowing_limit),
    active_loans: toNumber(record?.active_loans),
    overdue_loans: toNumber(record?.overdue_loans),
    outstanding_fines: toNumber(record?.outstanding_fines),
    total_loans: toNumber(record?.total_loans),
    is_blocked: Boolean(record?.is_blocked),
    block_reason: (record?.block_reason as string | null) ?? null,
  };
}

/** Desk search across names, e-mail, SBTR, card and ID numbers. */
export async function searchBorrowersForDesk(term: string, limit = 12): Promise<BorrowerOption[]> {
  const clean = sanitizeTerm(term ?? "");
  if (clean.length < 2) return [];

  const ids = await matchIds(clean);
  if (!ids.length) return [];

  const supabase = await createClient();
  const { data } = await supabase
    .from("users")
    .select(
      `id, full_name, email, is_active,
       profile:profiles!profiles_user_id_fkey(*),
       record:borrower_records!borrower_records_user_id_fkey(*)`,
    )
    .in("id", ids.slice(0, 40))
    .limit(limit);

  return ((data ?? []) as unknown as Record<string, unknown>[]).map(mapBorrowerOption);
}

export async function getBorrowerOption(userId: string): Promise<BorrowerOption | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("users")
    .select(
      `id, full_name, email, is_active,
       profile:profiles!profiles_user_id_fkey(*),
       record:borrower_records!borrower_records_user_id_fkey(*)`,
    )
    .eq("id", userId)
    .maybeSingle();
  return data ? mapBorrowerOption(data as Record<string, unknown>) : null;
}

/** All privileged writes land in the audit trail through the definer function. */
export async function writeAudit(
  action: string,
  entityType: string,
  entityId: string | null = null,
  metadata: Record<string, unknown> = {},
): Promise<void> {
  const supabase = await createClient();
  await supabase.rpc("write_audit", {
    p_action: action,
    p_entity_type: entityType,
    p_entity_id: entityId,
    p_metadata: metadata,
  });
}
