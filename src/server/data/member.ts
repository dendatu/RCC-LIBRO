import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, type AdminClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";
import { classificationLabel, isCollegeLevel, isSeniorHighLevel } from "@/lib/constants";
import type {
  AppNotification,
  AccountStatus,
  BorrowStatus,
  BorrowerSummary,
  CirculationSection,
  Fine,
  MemberProfile,
  Reservation,
  SbtrRow,
} from "@/lib/types";

/** A loan as the member sees it: the transaction plus the title and copy it came from. */
export interface MemberLoan {
  id: string;
  reference_no: string;
  status: BorrowStatus;
  section: CirculationSection;
  date_borrowed: string;
  due_date: string;
  date_returned: string | null;
  is_overdue: boolean;
  overdue_days: number;
  fine_charged: number;
  renewals_used: number;
  max_renewals: number;
  notes: string | null;
  book: {
    id: string;
    title: string;
    author: string;
    accession_number: string;
    call_number: string;
    cover_image_url: string | null;
    section: CirculationSection;
  } | null;
  copy: { id: string; barcode: string | null; shelf_location: string | null } | null;
}

export interface LoanEstimate extends MemberLoan {
  /** Fine accrued up to now, computed by the database policy engine. */
  estimated: number;
  accruesHourly: boolean;
}

export interface HistoryFilters {
  status?: BorrowStatus;
  from?: string;
  to?: string;
}

export interface MemberReservation extends Omit<Reservation, "book"> {
  book: {
    id: string;
    title: string;
    author: string;
    cover_image_url: string | null;
    available_copies: number;
    status: string;
    section: CirculationSection;
    call_number: string;
  } | null;
}

/** Whitelisted projection of a borrower card — safe for the public verification page. */
export interface CardStanding {
  card_number: string;
  sbtr_number: string | null;
  full_name: string;
  classification: string;
  account_status: AccountStatus;
  is_blocked: boolean;
  block_reason: string | null;
  outstanding_fines: number;
  active_loans: number;
  overdue_loans: number;
  member_since: string | null;
}

const LOAN_SELECT =
  "id, reference_no, status, section, date_borrowed, due_date, date_returned, is_overdue, overdue_days, fine_charged, renewals_used, max_renewals, notes, book:books(id, title, author, accession_number, call_number, cover_image_url, section), copy:book_copies(id, barcode, shelf_location)";

const OPEN_LOANS = ["active", "overdue"] as const;

export async function memberSummary(userId: string): Promise<BorrowerSummary> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("borrower_summary", { p_user_id: userId });
  return (data ?? {}) as BorrowerSummary;
}

export async function memberLoans(userId: string): Promise<MemberLoan[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("borrow_transactions")
    .select(LOAN_SELECT)
    .eq("borrower_id", userId)
    .in("status", [...OPEN_LOANS])
    .order("due_date", { ascending: true });
  return (data ?? []) as unknown as MemberLoan[];
}

export async function memberPastLoans(userId: string, limit = 40): Promise<MemberLoan[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("borrow_transactions")
    .select(LOAN_SELECT)
    .eq("borrower_id", userId)
    .not("status", "in", "('.active','.overdue')")
    .order("date_returned", { ascending: false, nullsFirst: false })
    .limit(limit);
  return (data ?? []) as unknown as MemberLoan[];
}

/** `sbtr_view` is the tracer record: one row per loan, already titled and branch-labelled. */
export async function sbtrEntries(userId: string): Promise<SbtrRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("sbtr_view")
    .select("*")
    .eq("borrower_id", userId)
    .order("date_borrowed", { ascending: true });
  return (data ?? []) as SbtrRow[];
}

/**
 * `borrow_transactions.librarian_id -> users` is readable by staff only, so this
 * resolves to an empty map for borrowers; the SBTR then credits the desk instead.
 */
export async function librarianNames(userId: string): Promise<Record<string, string>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("borrow_transactions")
    .select("id, librarian:users!borrow_transactions_librarian_id_fkey(full_name)")
    .eq("borrower_id", userId);
  if (error || !data) return {};
  const map: Record<string, string> = {};
  for (const row of (data ?? []) as unknown as { id: string; librarian: { full_name: string } | null }[]) {
    if (row.librarian?.full_name) map[row.id] = row.librarian.full_name;
  }
  return map;
}

export async function historyRows(userId: string, filters: HistoryFilters): Promise<SbtrRow[]> {
  const supabase = await createClient();
  const query = supabase
    .from("sbtr_view")
    .select("*")
    .eq("borrower_id", userId)
    .order("date_borrowed", { ascending: false })
    .limit(400);

  const filtered = filters.status ? query.eq("status", filters.status) : query;
  const ranged = filters.from
    ? filtered.gte("date_borrowed", `${filters.from}T00:00:00.000`)
    : filtered;
  const bounded = filters.to ? ranged.lte("date_borrowed", `${filters.to}T23:59:59.999`) : ranged;

  const { data } = await bounded;
  return (data ?? []) as SbtrRow[];
}

/** Return condition recorded at the desk, keyed by transaction id. */
export async function returnConditions(userId: string): Promise<Record<string, string>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("book_borrowing_history_view")
    .select("id, return_condition, barcode")
    .eq("borrower_id", userId);
  if (error || !data) return {};
  const map: Record<string, string> = {};
  for (const row of (data ?? []) as unknown as { id: string; return_condition: string | null; barcode: string | null }[]) {
    if (row.return_condition) map[row.id] = row.return_condition;
  }
  return map;
}

export async function memberFines(userId: string): Promise<Fine[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("fines")
    .select("*, book:books(title)")
    .eq("borrower_id", userId)
    .order("created_at", { ascending: false })
    .limit(200);
  const rows = (data ?? []) as (Fine & { book: { title: string } | null })[];
  return rows.map(({ book, ...fine }) => ({ ...fine, book_title: book?.title ?? null }));
}

export async function memberReservations(userId: string): Promise<MemberReservation[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("reservations")
    .select(
      "*, book:books(id, title, author, cover_image_url, available_copies, status, section, call_number)",
    )
    .eq("borrower_id", userId)
    .order("requested_at", { ascending: false })
    .limit(100);
  return (data ?? []) as unknown as MemberReservation[];
}

export async function memberNotifications(userId: string): Promise<AppNotification[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(150);
  return (data ?? []) as AppNotification[];
}

/** Live fine estimate per open loan, using the database's own `calculate_fine`. */
export async function openLoanEstimates(userId: string): Promise<LoanEstimate[]> {
  const loans = await memberLoans(userId);
  const supabase = await createClient();
  const asOf = new Date().toISOString();

  return Promise.all(
    loans.map(async (loan) => {
      const pastDue = new Date(loan.due_date).getTime() < Date.now();
      if (!pastDue) return { ...loan, estimated: 0, accruesHourly: loan.section === "reserve" };

      const { data } = await supabase.rpc("calculate_fine", {
        p_section: loan.section,
        p_due_date: loan.due_date,
        p_as_of: asOf,
      });
      return {
        ...loan,
        estimated: Number(data ?? 0),
        accruesHourly: loan.section === "reserve",
      };
    }),
  );
}

export async function estimateFineFor(
  section: CirculationSection,
  dueDate: string,
  asOf = new Date().toISOString(),
): Promise<number> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("calculate_fine", {
    p_section: section,
    p_due_date: dueDate,
    p_as_of: asOf,
  });
  return Number(data ?? 0);
}

/** Branches an unclassified member may still visit; the desk grants the rest. */
export function branchAccessFor(profile: MemberProfile | null): string[] {
  if (!profile?.borrower_type) return ["Main library reading room"];
  if (profile.borrower_type === "faculty") {
    switch (profile.faculty_department) {
      case "elementary":
        return ["Elementary Library", "High School Library"];
      case "high_school":
        return ["High School Library", "Elementary Library"];
      case "graduate_school":
        return ["College and Graduate School Library"];
      default:
        return ["College and Graduate School Library", "High School Library"];
    }
  }
  if (isCollegeLevel(profile.education_level) || profile.education_level === "graduate" || profile.college_program) {
    return ["College and Graduate School Library", "High School Library"];
  }
  if (isSeniorHighLevel(profile.education_level)) {
    return ["High School Library", "Elementary Library"];
  }
  if (profile.education_level) {
    return ["Elementary Library", "High School Library"];
  }
  return ["Main library reading room"];
}

function toStanding(input: {
  profile: Record<string, unknown>;
  fullName: string;
  record: Record<string, unknown> | null;
}): CardStanding {
  const profile = input.profile as unknown as MemberProfile;
  return {
    card_number: String(input.profile.card_number ?? ""),
    sbtr_number: (input.profile.sbtr_number as string | null) ?? null,
    full_name: input.fullName,
    classification: classificationLabel(profile),
    account_status: (input.record?.status as AccountStatus) ?? "active",
    is_blocked: Boolean(input.record?.is_blocked),
    block_reason: (input.record?.block_reason as string | null) ?? null,
    outstanding_fines: Number(input.record?.outstanding_fines ?? 0),
    active_loans: Number(input.record?.active_loans ?? 0),
    overdue_loans: Number(input.record?.overdue_loans ?? 0),
    member_since: (profile.created_at as string | null) ?? null,
  };
}

async function cardFromClient(client: AdminClient, candidates: string[]): Promise<CardStanding | null> {
  const { data: profile } = await client
    .from("profiles")
    .select(
      "user_id, borrower_type, education_level, senior_high_track, college_program, faculty_department, sbtr_number, card_number, created_at",
    )
    .in("card_number", candidates)
    .maybeSingle();
  if (!profile?.user_id) return null;

  const [{ data: account }, { data: record }] = await Promise.all([
    client.from("users").select("full_name").eq("id", profile.user_id).maybeSingle(),
    client
      .from("borrower_records")
      .select("status, is_blocked, block_reason, outstanding_fines, active_loans, overdue_loans")
      .eq("user_id", profile.user_id)
      .maybeSingle(),
  ]);
  if (!account?.full_name) return null;

  return toStanding({ profile, fullName: account.full_name, record });
}

/**
 * Resolves a library card number to a standing verdict. The session client
 * satisfies the member's own lookup and the desk (staff); anonymous scans fall
 * back to the service-role client, which is only used for this whitelisted read.
 */
export async function resolveCardStanding(cardNumber: string): Promise<CardStanding | null> {
  const trimmed = cardNumber.trim();
  if (!trimmed) return null;
  const candidates = Array.from(new Set([trimmed, trimmed.toUpperCase(), trimmed.toLowerCase()]));

  const session = await createClient();
  const viaSession = await cardFromClient(session as unknown as AdminClient, candidates);
  if (viaSession) return viaSession;
  if (!env.SUPABASE_SERVICE_ROLE_KEY) return null;

  try {
    return await cardFromClient(createAdminClient(), candidates);
  } catch {
    return null;
  }
}
