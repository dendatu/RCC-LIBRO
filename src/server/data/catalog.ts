import "server-only";

import { createClient } from "@/lib/supabase/server";
import type {
  BookCategory,
  BookCopy,
  BookRecord,
  BookStatus,
  BorrowStatus,
  CatalogueBook,
  CirculationSection,
  CopyStatus,
  Library,
  ReturnCondition,
} from "@/lib/types";

export const CATALOGUE_PAGE_SIZE = 12;

export interface CatalogQuery {
  q?: string;
  library?: number;
  section?: CirculationSection;
  category?: number;
  status?: BookStatus;
  onlyAvailable?: boolean;
  limit?: number;
  offset?: number;
}

/** A row returned by the `search_books` RPC (minus its window function count). */
export interface SearchBookRow {
  id: string;
  title: string;
  author: string;
  call_number: string;
  accession_number: string;
  cover_image_url: string | null;
  section: CirculationSection;
  status: BookStatus;
  library_name: string;
  category_name: string | null;
  total_copies: number;
  available_copies: number;
  publication_year: number | null;
}

export interface CataloguePage {
  rows: SearchBookRow[];
  total: number;
  limit: number;
  offset: number;
}

/** `book_borrowing_history_view` — shown on a title page and QR landing page. */
export interface BorrowHistoryRow {
  id: string;
  book_id: string;
  copy_id: string | null;
  title: string;
  author: string;
  accession_number: string;
  call_number: string | null;
  barcode: string | null;
  borrower_id: string;
  borrower_name: string;
  borrower_classification: string | null;
  section: string | null;
  date_borrowed: string;
  due_date: string;
  date_returned: string | null;
  status: BorrowStatus;
  return_condition: ReturnCondition | null;
  fine_assessed: number | null;
}

/** A physical copy joined to the title it belongs to. */
export interface InventoryCopy extends BookCopy {
  book: Pick<
    CatalogueBook,
    "id" | "title" | "author" | "accession_number" | "call_number" | "section" | "library_id"
  > | null;
}

export interface InventoryQuery {
  branch?: number;
  statuses?: CopyStatus[];
  q?: string;
  bookId?: string;
  limit?: number;
  offset?: number;
}

export interface InventoryPage {
  rows: InventoryCopy[];
  total: number;
  limit: number;
  offset: number;
}

/** Strips PostgREST wildcard/separator characters so an `or=(...)` filter stays parseable. */
function safeTerm(value: string | undefined) {
  const trimmed = (value ?? "").trim();
  if (!trimmed) return null;
  return trimmed.replace(/[%_(),"'\\]/g, " ").replace(/\s+/g, " ").slice(0, 80) || null;
}

export async function searchCatalogue(query: CatalogQuery = {}): Promise<CataloguePage> {
  const supabase = await createClient();
  const limit = Math.min(60, Math.max(1, query.limit ?? CATALOGUE_PAGE_SIZE));
  const offset = Math.max(0, query.offset ?? 0);

  const { data } = await supabase.rpc("search_books", {
    p_query: safeTerm(query.q),
    p_library: query.library ?? null,
    p_section: query.section ?? null,
    p_category: query.category ?? null,
    p_status: query.status ?? null,
    p_only_available: query.onlyAvailable ?? false,
    p_limit: limit,
    p_offset: offset,
  });

  const rows = (data ?? []) as unknown as (SearchBookRow & { total_count: number })[];
  return {
    rows: rows as unknown as SearchBookRow[],
    total: Number(rows[0]?.total_count ?? 0),
    limit,
    offset,
  };
}

export async function getBook(id: string): Promise<CatalogueBook | null> {
  if (!id) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("books")
    .select("*, library:libraries(id, code, name), category:book_categories(id, name, slug)")
    .eq("id", id)
    .maybeSingle();
  if (!data) return null;
  return flattenBook(data as unknown as RawBook);
}

export async function listBooksByIds(ids: string[]): Promise<CatalogueBook[]> {
  const unique = Array.from(new Set(ids)).filter(Boolean);
  if (unique.length === 0) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("books")
    .select("*, library:libraries(id, code, name), category:book_categories(id, name, slug)")
    .in("id", unique);
  return (data ?? []).map((row) => flattenBook(row as unknown as RawBook) as CatalogueBook);
}

export async function getBookByAccession(accessionNumber: string): Promise<CatalogueBook | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("books")
    .select("*, library:libraries(id, code, name), category:book_categories(id, name, slug)")
    .eq("accession_number", accessionNumber)
    .maybeSingle();
  return data ? (flattenBook(data as unknown as RawBook) as CatalogueBook) : null;
}

interface RawBook {
  [key: string]: unknown;
  id: string;
  library?: { id: number; code: string; name: string } | null;
  category?: { id: number; name: string; slug: string } | null;
}

/** Turns the nested PostgREST embed into the flat `book_inventory_view` shape. */
export function flattenBook(row: RawBook): CatalogueBook {
  const library = row.library;
  const category = row.category;
  return {
    ...(row as unknown as CatalogueBook),
    library_id: Number(library?.id ?? row.library_id ?? 0),
    library_code: library?.code ?? "",
    library_name: library?.name ?? "",
    category_id: category ? Number(category.id) : null,
    category_name: category?.name ?? null,
    category_slug: category?.slug ?? null,
  };
}

export async function listLibraries(): Promise<Library[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("libraries").select("*").eq("is_active", true).order("sort_order");
  return (data ?? []) as unknown as Library[];
}

export async function listCategories(): Promise<BookCategory[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("book_categories")
    .select("*")
    .eq("is_active", true)
    .order("sort_order");
  return (data ?? []) as unknown as BookCategory[];
}

export async function listCopiesByBook(bookId: string): Promise<BookCopy[]> {
  if (!bookId) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("book_copies")
    .select("*")
    .eq("book_id", bookId)
    .order("copy_number");
  return normaliseCopies(data);
}

export async function listBookRecords(bookId: string): Promise<BookRecord[]> {
  if (!bookId) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("book_records")
    .select("*")
    .eq("book_id", bookId)
    .order("issued_at");
  return (data ?? []) as unknown as BookRecord[];
}

export async function listBookRecordByCopy(copyId: string): Promise<BookRecord | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("book_records")
    .select("*")
    .eq("copy_id", copyId)
    .maybeSingle();
  return (data as unknown as BookRecord) ?? null;
}

export async function listBorrowHistory(bookId: string, limit = 12): Promise<BorrowHistoryRow[]> {
  if (!bookId) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("book_borrowing_history_view")
    .select("*")
    .eq("book_id", bookId)
    .order("date_borrowed", { ascending: false })
    .limit(limit);
  return ((data ?? []) as unknown as BorrowHistoryRow[]).map((row) => ({
    ...row,
    fine_assessed: Number(row.fine_assessed ?? 0),
  }));
}

function normaliseCopies(data: unknown): BookCopy[] {
  return ((data ?? []) as unknown as BookCopy[]).map((copy) => ({
    ...copy,
    acquisition_price: copy.acquisition_price === null ? null : Number(copy.acquisition_price),
  }));
}

/** Copies of a single title, with the parent row attached for the QR studio. */
export async function listInventoryForBook(bookId: string): Promise<InventoryCopy[]> {
  const [copies, book] = await Promise.all([listCopiesByBook(bookId), getBook(bookId)]);
  if (!book) return copies.map((copy) => ({ ...copy, book: null }));
  return copies.map((copy) => ({ ...copy, book }));
}

/**
 * Physical copies across the branches. PostgREST cannot mix embedded-path and
 * top-level predicates inside one `or`, so a free-text term is resolved to
 * candidate titles first and then matched against barcode / accession / shelf.
 */
export async function listInventory(query: InventoryQuery = {}): Promise<InventoryPage> {
  const supabase = await createClient();
  const limit = Math.min(100, Math.max(1, query.limit ?? 40));
  const offset = Math.max(0, query.offset ?? 0);
  const term = safeTerm(query.q);

  const titleIds = term ? await matchingBookIds(term, query.branch) : null;

  const builder = supabase
    .from("book_copies")
    .select(
      "*, book:books!inner(id, title, author, accession_number, call_number, section, library_id)",
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .order("copy_number", { ascending: true })
    .range(offset, offset + limit - 1);

  if (query.bookId) builder.eq("book_id", query.bookId);
  if (query.branch) builder.eq("book.library_id", query.branch);
  if (query.statuses?.length) builder.in("status", query.statuses);

  if (term) {
    const clauses = [
      `barcode.ilike.%${term}%`,
      `accession_number.ilike.%${term}%`,
      `shelf_location.ilike.%${term}%`,
    ];
    if (titleIds?.length) clauses.push(`book_id.in.(${titleIds.join(",")})`);
    builder.or(clauses.join(","));
  }

  const { data, count } = await builder;
  const rows = ((data ?? []) as unknown as InventoryCopy[]).map((row) => ({
    ...row,
    acquisition_price: row.acquisition_price === null ? null : Number(row.acquisition_price),
  }));

  return { rows, total: Number(count ?? rows.length), limit, offset };
}

async function matchingBookIds(term: string, branch?: number): Promise<string[]> {
  const page = await searchCatalogue({ q: term, library: branch, limit: 60 });
  return page.rows.map((row) => row.id);
}

const COPY_STATUSES: CopyStatus[] = [
  "available",
  "borrowed",
  "reserved",
  "damaged",
  "lost",
  "processing",
  "maintenance",
];

/** Counts per copy status — drives the lost/damaged queue tiles. */
export async function countCopiesByStatus(): Promise<Record<CopyStatus, number>> {
  const supabase = await createClient();
  const counts = await Promise.all(
    COPY_STATUSES.map((status) =>
      supabase
        .from("book_copies")
        .select("id", { count: "exact", head: true })
        .eq("status", status)
        .then(({ count }) => Number(count ?? 0)),
    ),
  );
  return COPY_STATUSES.reduce<Record<CopyStatus, number>>((acc, status, index) => {
    acc[status] = counts[index];
    return acc;
  }, {
    available: 0,
    borrowed: 0,
    reserved: 0,
    damaged: 0,
    lost: 0,
    processing: 0,
    maintenance: 0,
  });
}

export async function getCopyByBarcode(barcode: string): Promise<BookCopy | null> {
  if (!barcode) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("book_copies")
    .select("*")
    .eq("barcode", barcode)
    .maybeSingle();
  return data ? normaliseCopies([data])[0] : null;
}

export async function listRecentLoansForCopy(copyId: string): Promise<BorrowHistoryRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("book_borrowing_history_view")
    .select("*")
    .eq("copy_id", copyId)
    .order("date_borrowed", { ascending: false })
    .limit(8);
  return ((data ?? []) as unknown as BorrowHistoryRow[]).map((row) => ({
    ...row,
    fine_assessed: Number(row.fine_assessed ?? 0),
  }));
}

export async function countOpenLoansForBook(bookId: string): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase
    .from("borrow_transactions")
    .select("id", { count: "exact", head: true })
    .eq("book_id", bookId)
    .in("status", ["active", "overdue"]);
  return Number(count ?? 0);
}

export async function isAccessionTaken(accessionNumber: string, exceptBookId?: string): Promise<boolean> {
  const supabase = await createClient();
  let builder = supabase
    .from("books")
    .select("id", { count: "exact", head: true })
    .eq("accession_number", accessionNumber);
  if (exceptBookId) builder = builder.neq("id", exceptBookId);
  const { count } = await builder;
  return Number(count ?? 0) > 0;
}

export async function maxCopyNumberForBook(bookId: string): Promise<number> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("book_copies")
    .select("copy_number")
    .eq("book_id", bookId)
    .order("copy_number", { ascending: false })
    .limit(1);
  const rows = (data ?? []) as unknown as { copy_number: number }[];
  return Number(rows[0]?.copy_number ?? 0);
}

/** Highest issued `BCnnnnnn` label, used to mint the next barcode. */
export async function lastBarcodeSequence(): Promise<number> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("book_copies")
    .select("barcode")
    .like("barcode", "BC%")
    .order("barcode", { ascending: false })
    .limit(1);
  const rows = (data ?? []) as unknown as { barcode: string }[];
  const raw = rows[0]?.barcode ?? "";
  const digits = Number(raw.replace(/\D/g, ""));
  return Number.isFinite(digits) ? digits : 0;
}

export async function listNewArrivals(limit = 12): Promise<NewArrivalRow[]> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("recently_added", { p_limit: limit });
  return (data ?? []) as unknown as NewArrivalRow[];
}

export interface NewArrivalRow {
  id: string;
  title: string;
  author: string;
  cover_image_url: string | null;
  library_name: string;
  section: string;
  created_at: string;
}

export interface RecommendationRow {
  id: string;
  title: string;
  author: string;
  cover_image_url: string | null;
  reason: string;
}

export async function listRecommendations(userId: string, limit = 8): Promise<RecommendationRow[]> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("recommended_books", { p_user_id: userId, p_limit: limit });
  return (data ?? []) as unknown as RecommendationRow[];
}

export interface PopularRow {
  book_id: string;
  title: string;
  author: string;
  loans: number;
  library_name: string;
  cover_image_url: string | null;
}

export async function listPopularBooks(limit = 10): Promise<PopularRow[]> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("popular_books", { p_limit: limit });
  return ((data ?? []) as unknown as PopularRow[]).map((row) => ({
    ...row,
    loans: Number(row.loans ?? 0),
  }));
}

/** Titles carrying at least one physical copy, newest first — drives the QR studio picker. */
export async function listTitlesForQrStudio(branch?: number, q?: string, limit = 24): Promise<CatalogueBook[]> {
  const page = await searchCatalogue({
    q,
    library: branch,
    limit: Math.min(60, Math.max(1, limit)),
  });
  return listBooksByIds(page.rows.map((row) => row.id));
}

export async function writeAudit(
  action: string,
  entityType: string,
  entityId: string | null,
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
