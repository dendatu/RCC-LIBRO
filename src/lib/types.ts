export type RoleSlug = "borrower" | "librarian" | "admin";

export type BorrowerType = "student" | "faculty";

export type EducationLevel =
  | "kinder"
  | "grade_1"
  | "grade_2"
  | "grade_3"
  | "grade_4"
  | "grade_5"
  | "grade_6"
  | "grade_7"
  | "grade_8"
  | "grade_9"
  | "grade_10"
  | "grade_11"
  | "grade_12"
  | "college_1st_year"
  | "college_2nd_year"
  | "college_3rd_year"
  | "college_4th_year"
  | "graduate";

export type SeniorHighTrack = "pba" | "ssh" | "peat" | "phs";

export type CollegeProgram =
  | "abel"
  | "bsa"
  | "bsce"
  | "bsit"
  | "bsba"
  | "bshm"
  | "bstm"
  | "beed"
  | "bsed_english"
  | "bsed_mathematics"
  | "bsed_filipino"
  | "graduate_school";

export type FacultyDepartment = "elementary" | "high_school" | "college" | "graduate_school";

export type CirculationSection =
  | "general"
  | "filipiniana"
  | "home_reading"
  | "fiction"
  | "newly_acquired"
  | "reserve"
  | "research_output"
  | "reference"
  | "periodicals";

export type BookStatus = "available" | "borrowed" | "reserved" | "damaged" | "lost" | "processing";

export type CopyStatus = BookStatus | "maintenance";

export type BorrowStatus = "active" | "returned" | "overdue" | "lost" | "damaged" | "cancelled";

export type ReturnCondition = "good" | "damaged" | "lost";

export type FineType = "overdue_daily" | "reserve_hourly" | "lost_book" | "damaged_book" | "manual";

export type FineStatus = "pending" | "paid" | "waived" | "disputed";

export type ReservationStatus = "waiting" | "ready" | "fulfilled" | "cancelled" | "expired";

export type AccountStatus = "active" | "suspended" | "graduated" | "inactive";

export type NotificationType =
  | "due_reminder"
  | "overdue"
  | "reservation_ready"
  | "fine_assessed"
  | "fine_settled"
  | "account"
  | "system";

export interface AppUser {
  id: string;
  full_name: string;
  email: string;
  avatar_url: string | null;
  contact_number: string | null;
  is_active: boolean;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface MemberProfile {
  id: string;
  user_id: string;
  borrower_type: BorrowerType | null;
  education_level: EducationLevel | null;
  senior_high_track: SeniorHighTrack | null;
  college_program: CollegeProgram | null;
  faculty_department: FacultyDepartment | null;
  sbtr_number: string | null;
  id_number: string | null;
  section: string | null;
  enrollment_year: number | null;
  card_number: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface BorrowerRecord {
  user_id: string;
  status: AccountStatus;
  borrowing_limit: number;
  loan_period_days: number;
  active_loans: number;
  overdue_loans: number;
  outstanding_fines: number;
  total_loans: number;
  last_borrowed_at: string | null;
  is_blocked: boolean;
  block_reason: string | null;
}

export interface Library {
  id: number;
  code: string;
  name: string;
  description: string | null;
  address: string | null;
  contact_number: string | null;
  email: string | null;
  is_active: boolean;
  sort_order: number;
}

export interface BookCategory {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  parent_id: number | null;
  sort_order: number;
  is_active: boolean;
}

export interface Book {
  id: string;
  accession_number: string;
  call_number: string;
  isbn: string | null;
  title: string;
  author: string;
  subject: string | null;
  publisher: string | null;
  publication_year: number | null;
  edition: string | null;
  language: string;
  category_id: number | null;
  library_id: number;
  section: CirculationSection;
  description: string | null;
  cover_image_url: string | null;
  total_copies: number;
  available_copies: number;
  status: BookStatus;
  qr_code_url: string | null;
  is_published: boolean;
  created_at: string;
  updated_at: string;
}

/** Rows of `book_inventory_view` — the catalogue read model. */
export interface CatalogueBook extends Book {
  library_code: string;
  library_name: string;
  category_name: string | null;
  category_slug: string | null;
}

export interface BookCopy {
  id: string;
  book_id: string;
  barcode: string;
  accession_number: string | null;
  copy_number: number;
  status: CopyStatus;
  condition: string;
  shelf_location: string | null;
  acquisition_date: string | null;
  acquisition_price: number | null;
  source: string | null;
  is_library_use_only: boolean;
  notes: string | null;
}

export interface BookRecord {
  id: string;
  book_id: string;
  copy_id: string | null;
  title: string;
  author: string;
  accession_number: string | null;
  call_number: string | null;
  qr_payload: string;
  qr_image_url: string | null;
  issued_at: string;
}

export interface BorrowTransaction {
  id: string;
  reference_no: string;
  borrower_id: string;
  book_id: string;
  copy_id: string;
  library_id: number;
  librarian_id: string | null;
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
  source: string;
  notes: string | null;
}

/** `sbtr_view` — the transaction as rendered on a tracer record. */
export interface SbtrRow extends BorrowTransaction {
  borrower_name: string;
  borrower_email: string;
  book_title: string;
  book_author: string;
  accession_number: string;
  call_number: string;
  library_name: string;
}

export interface Fine {
  id: string;
  borrower_id: string;
  borrow_transaction_id: string | null;
  book_id: string | null;
  type: FineType;
  amount: number;
  status: FineStatus;
  unit_count: number;
  currency: string;
  computed_from: string | null;
  computed_to: string | null;
  paid_at: string | null;
  paid_via: string | null;
  waiver_reason: string | null;
  notes: string | null;
  created_at: string;
  book_title?: string | null;
  borrower_name?: string | null;
}

export interface Reservation {
  id: string;
  book_id: string;
  copy_id: string | null;
  borrower_id: string;
  status: ReservationStatus;
  queue_position: number;
  held_until: string | null;
  requested_at: string;
  ready_at: string | null;
  fulfilled_at: string | null;
  cancelled_at: string | null;
  book?: Pick<CatalogueBook, "id" | "title" | "author" | "cover_image_url" | "available_copies">;
}

export interface AppNotification {
  id: number;
  user_id: string;
  type: NotificationType;
  title: string;
  body: string;
  link: string | null;
  is_read: boolean;
  created_at: string;
}

export interface AuditLogRow {
  id: number;
  actor_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  actor_name?: string | null;
}

export interface EmailLogRow {
  id: number;
  recipient: string;
  template: string;
  subject: string;
  status: "queued" | "sent" | "bounced" | "failed" | "skipped";
  provider: string;
  error: string | null;
  queued_at: string;
  sent_at: string | null;
}

export interface SettingRow {
  key: string;
  value: unknown;
  label: string;
  description: string | null;
  group_name: string;
  updated_at: string;
}

/** Authenticated view of the signed-in account, resolved once per request. */
export interface SessionMember {
  user: AppUser;
  profile: MemberProfile | null;
  record: BorrowerRecord | null;
  roles: RoleSlug[];
  role: RoleSlug;
}

export interface ActionResult<T = undefined> {
  ok: boolean;
  message?: string;
  code?: string;
  data?: T;
  errors?: Record<string, string[]>;
}

export interface DashboardStats {
  total_books: number;
  total_copies: number;
  available_copies: number;
  borrowed_copies: number;
  reserved_copies: number;
  damaged_copies: number;
  lost_copies: number;
  overdue_loans: number;
  active_loans: number;
  total_borrowers: number;
  registered_users: number;
  collected_fines: number;
  outstanding_fines: number;
  open_reservations: number;
  new_titles_30d: number;
}

export interface TrendPoint {
  bucket: string;
  loans: number;
  returns: number;
}

export interface NamedCount {
  category?: string;
  name?: string;
  label?: string;
  loans: number;
}

export interface LibraryUsageRow {
  library_id: number;
  library: string;
  titles: number;
  copies: number;
  active_loans: number;
  overdue: number;
}

export interface BorrowerSummary {
  active_loans: number;
  due_soon: number;
  overdue: number;
  lifetime_loans: number;
  pending_fines: number;
  open_reservations: number;
  unread_notifications: number;
}
