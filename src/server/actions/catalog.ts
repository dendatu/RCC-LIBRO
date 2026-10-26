"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { copyUrl } from "@/lib/qr";
import { guardRole } from "@/lib/rbac";
import { createClient } from "@/lib/supabase/server";
import {
  bookSchema,
  booleanField,
  copySchema,
  copyUpdateSchema,
  fieldErrors,
} from "@/lib/validators";
import type { BookCopy, CatalogueBook, CopyStatus } from "@/lib/types";
import type { ActionResult } from "@/lib/types";
import { z } from "zod";
import {
  countOpenLoansForBook,
  getBook,
  isAccessionTaken,
  lastBarcodeSequence,
  listBookRecordByCopy,
  maxCopyNumberForBook,
  writeAudit,
} from "@/server/data/catalog";

type SessionClient = Awaited<ReturnType<typeof createClient>>;

const idSchema = z.object({ id: z.string().uuid("Missing title reference") });

/** Empty strings break `z.coerce.number()` — those fields are dropped instead. */
const NUMERIC_FIELDS = new Set([
  "publicationYear",
  "categoryId",
  "libraryId",
  "acquisitionPrice",
  "copyCount",
  "count",
]);

function toValues(form: FormData): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  for (const [key, value] of form.entries()) {
    if (typeof value !== "string") continue;
    if (value === "" && NUMERIC_FIELDS.has(key)) continue;
    payload[key] = value;
  }
  return payload;
}

function invalid<T = undefined>(
  message: string,
  errors: Record<string, string[]> = {},
): ActionResult<T> {
  return { ok: false, message, errors };
}

/** Postgres 23505 surfaced as reference-desk language instead of a raw constraint name. */
function uniqueViolation(error: { code?: string; message?: string } | null | undefined): string | null {
  if (!error || error.code !== "23505") return null;
  const message = error.message ?? "";
  if (/barcode/i.test(message)) {
    return "That barcode label is already attached to another copy. Print a fresh label and try again.";
  }
  if (/copy_number|book_copies_accession/i.test(message)) {
    return "That copy number is already registered for this title. Refresh the inventory and try again.";
  }
  return "That accession number is already recorded in the accession book. Accession numbers must be unique — confirm the next free number with the circulation desk.";
}

function revalidateCatalogue(bookId?: string | null, barcode?: string | null) {
  for (const path of [
    "/dashboard",
    "/dashboard/catalog",
    "/dashboard/inventory",
    "/dashboard/qr",
    "/dashboard/new-arrivals",
    "/dashboard/recommendations",
    "/opac",
  ]) {
    revalidatePath(path);
  }
  if (bookId) {
    revalidatePath(`/dashboard/catalog/${bookId}`);
    revalidatePath(`/dashboard/catalog/${bookId}/edit`);
  }
  if (barcode) revalidatePath(`/book/${barcode}`);
}

const pad = (value: number, size: number) => String(value).padStart(size, "0");

interface CopyDraft {
  bookId: string;
  accessionNumber: string;
  count: number;
  shelfLocation?: string | null;
  condition?: string | null;
  acquisitionPrice?: number | null;
  acquisitionDate?: string | null;
}

/** Registers physical copies; the trigger chain issues the book card and refreshes counters. */
async function insertCopies(
  supabase: SessionClient,
  draft: CopyDraft,
): Promise<{ rows: BookCopy[]; error: { code?: string; message?: string } | null }> {
  const startCopy = await maxCopyNumberForBook(draft.bookId);
  const startBarcode = await lastBarcodeSequence();

  const payload = Array.from({ length: draft.count }, (_, index) => {
    const copyNumber = startCopy + index + 1;
    return {
      book_id: draft.bookId,
      barcode: `BC${pad(startBarcode + index + 1, 6)}`,
      accession_number: `${draft.accessionNumber}-${pad(copyNumber, 2)}`,
      copy_number: copyNumber,
      status: "available" as const,
      condition: draft.condition?.trim() || "Good",
      shelf_location: draft.shelfLocation?.trim() || null,
      acquisition_date: draft.acquisitionDate ?? new Date().toISOString().slice(0, 10),
      acquisition_price: draft.acquisitionPrice ?? null,
      source: "Accession book",
    };
  });

  const { data, error } = await supabase.from("book_copies").insert(payload).select("*");

  /**
   * `trg_book_copies_counters` already refreshes the roll-up, but the counters
   * drive availability everywhere in the app, so the write path asks the
   * database to recompute them explicitly instead of relying on the trigger.
   */
  await supabase.rpc("refresh_book_counters", { p_book_id: draft.bookId });

  return {
    rows: ((data ?? []) as unknown as BookCopy[]).map((copy) => ({
      ...copy,
      acquisition_price: copy.acquisition_price === null ? null : Number(copy.acquisition_price),
    })),
    error: error ?? null,
  };
}

/**
 * Shared accession write path — creates or updates the title row and, on
 * create, registers the physical copies. Copies are inserted from TypeScript,
 * so `refresh_book_counters` is called explicitly and the `on_copy_created`
 * trigger issues one digital book card per copy.
 */
async function saveBook(form: FormData, mode: "create" | "update"): Promise<ActionResult<AccessionResult>> {
  const member = await guardRole("librarian", "admin");
  const values = toValues(form);

  let bookId: string | null = null;
  if (mode === "update") {
    const parsedId = idSchema.safeParse({ id: values.id });
    if (!parsedId.success) return invalid("Missing title reference.", { id: ["Missing title reference."] });
    bookId = parsedId.data.id;
  }

  const parsed = bookSchema.safeParse(values);
  if (!parsed.success) {
    return invalid("Check the highlighted fields on the accession form.", fieldErrors(parsed.error));
  }
  const input = parsed.data;

  if (await isAccessionTaken(input.accessionNumber, bookId ?? undefined)) {
    return invalid("Accession numbers must be unique.", {
      accessionNumber: [
        bookId
          ? "This accession number belongs to another title."
          : "This accession number is already recorded in the accession book.",
      ],
    });
  }

  const details = {
    accession_number: input.accessionNumber,
    call_number: input.callNumber,
    isbn: input.isbn || null,
    title: input.title,
    author: input.author,
    subject: input.subject || null,
    publisher: input.publisher || null,
    publication_year: input.publicationYear ?? null,
    edition: input.edition || null,
    language: input.language || "English",
    category_id: input.categoryId ?? null,
    library_id: input.libraryId,
    section: input.section,
    description: input.description || null,
    cover_image_url: input.coverImageUrl || null,
    is_published: input.isPublished,
  };

  const supabase = await createClient();

  if (bookId) {
    const existing = await getBook(bookId);
    if (!existing) return invalid("That title is no longer in the catalogue.", { id: ["Title not found."] });

    const { error } = await supabase.from("books").update(details).eq("id", bookId);
    if (error) {
      const friendly = uniqueViolation(error);
      if (friendly) return invalid(friendly, { accessionNumber: [friendly] });
      return invalid("The catalogue record could not be updated.", { form: [error.message] });
    }

    await writeAudit("catalogue.title_updated", "book", bookId, {
      accession_number: input.accessionNumber,
      title: input.title,
      section: input.section,
      actor: member.user.full_name,
    });
    revalidateCatalogue(bookId, input.accessionNumber);

    return {
      ok: true,
      data: { bookId, copies: existing.total_copies } satisfies AccessionResult,
      message: `Catalogue record for “${input.title}” updated.`,
    };
  }

  const { data: created, error } = await supabase
    .from("books")
    .insert({ ...details, added_by: member.user.id })
    .select("id")
    .single();

  if (error || !created) {
    const friendly = uniqueViolation(error);
    if (friendly) return invalid(friendly, { accessionNumber: [friendly] });
    return invalid("The title could not be accessioned. Please try again.", {
      form: [error?.message ?? "Unknown error"],
    });
  }

  const newBookId = String(created.id);
  let copies = 0;
  let copyError: string | null = null;

  if (input.copyCount > 0) {
    const result = await insertCopies(supabase, {
      bookId: newBookId,
      accessionNumber: input.accessionNumber,
      count: input.copyCount,
      condition: "Good",
      acquisitionPrice: input.acquisitionPrice ?? null,
    });
    copies = result.rows.length;
    copyError = uniqueViolation(result.error) ?? result.error?.message ?? null;
  }

  await writeAudit("catalogue.title_created", "book", newBookId, {
    accession_number: input.accessionNumber,
    title: input.title,
    section: input.section,
    copies,
    actor: member.user.full_name,
  });
  revalidateCatalogue(newBookId);

  if (copyError) {
    return {
      ok: true,
      data: { bookId: newBookId, copies },
      message: `Title accessioned, but the copies were not registered (${copyError}). Use “Add copies” on the title page.`,
    };
  }

  return {
    ok: true,
    data: { bookId: newBookId, copies },
    message:
      copies > 0
        ? `“${input.title}” accessioned with ${copies} cop${copies === 1 ? "y" : "ies"}. Book cards are ready to print.`
        : `“${input.title}” accessioned with no copies yet — it shows as processing until stock is registered.`,
  };
}

export async function createBookAction(
  _prev: LooseActionResult | null,
  form: FormData,
): Promise<LooseActionResult> {
  return saveBook(form, "create");
}

export async function updateBookAction(
  _prev: LooseActionResult | null,
  form: FormData,
): Promise<LooseActionResult> {
  return saveBook(form, "update");
}

/** Legacy name kept for the shared accession form: redirects to the record. */
export async function createBook(
  _prev: ActionResult | null,
  form: FormData,
): Promise<ActionResult<{ bookId: string; copies: number }>> {
  const result = await saveBook(form, "create");
  if (result.ok && result.data) redirect(`/dashboard/catalog/${result.data.bookId}?created=1`);
  return result as ActionResult<{ bookId: string; copies: number }>;
}

/** Legacy name kept for the shared accession form: redirects back to the record. */
export async function updateBook(
  _prev: ActionResult | null,
  form: FormData,
): Promise<ActionResult<{ bookId: string }>> {
  const result = await saveBook(form, "update");
  if (result.ok && result.data) redirect(`/dashboard/catalog/${result.data.bookId}?saved=1`);
  return result as ActionResult<{ bookId: string }>;
}

/** Soft delete: the record stops appearing in OPAC and the catalogue read model. */
export async function archiveBook(
  _prev: ActionResult | null,
  form: FormData,
): Promise<ActionResult<{ bookId: string }>> {
  await guardRole("librarian", "admin");

  const parsed = idSchema.safeParse(toValues(form));
  if (!parsed.success) return invalid("Missing title reference.", { id: ["Missing title reference."] });
  const bookId = parsed.data.id;

  const book = await getBook(bookId);
  if (!book) return invalid("That title is no longer in the catalogue.", { id: ["Title not found."] });

  const openLoans = await countOpenLoansForBook(bookId);
  if (openLoans > 0) {
    return invalid(
      `${openLoans} loan(s) of “${book.title}” are still open. Clear them at the circulation desk before withdrawing the title.`,
    );
  }

  const supabase = await createClient();
  const { error } = await supabase.from("books").update({ is_published: false }).eq("id", bookId);
  if (error) return invalid("The title could not be withdrawn.", { form: [error.message] });

  await writeAudit("catalogue.title_archived", "book", bookId, {
    accession_number: book.accession_number,
    title: book.title,
  });
  revalidateCatalogue(bookId);

  return { ok: true, data: { bookId }, message: `“${book.title}” is withdrawn from the public catalogue.` };
}

/** Permanent removal. Only allowed once the copy has no open or overdue loans. */
export async function deleteBook(
  _prev: ActionResult | null,
  form: FormData,
): Promise<ActionResult> {
  await guardRole("librarian", "admin");

  const parsed = idSchema.safeParse(toValues(form));
  if (!parsed.success) return invalid("Missing title reference.", { id: ["Missing title reference."] });
  const bookId = parsed.data.id;

  const book = await getBook(bookId);
  if (!book) return invalid("That title is no longer in the catalogue.", { id: ["Title not found."] });

  const openLoans = await countOpenLoansForBook(bookId);
  if (openLoans > 0) {
    return invalid(
      `Deletion blocked: ${openLoans} loan(s) of “${book.title}” are still open or overdue.`,
    );
  }

  const supabase = await createClient();
  const { error } = await supabase.from("books").delete().eq("id", bookId);
  if (error) return invalid("The title could not be deleted.", { form: [error.message] });

  await writeAudit("catalogue.title_deleted", "book", bookId, {
    accession_number: book.accession_number,
    title: book.title,
    copies: book.total_copies,
  });
  revalidateCatalogue(bookId);

  return { ok: true, message: `“${book.title}” and its copies were permanently removed from the catalogue.` };
}

export async function addCopies(
  _prev: ActionResult | null,
  form: FormData,
): Promise<ActionResult<{ bookId: string; copies: number }>> {
  await guardRole("librarian", "admin");

  const parsed = copySchema.safeParse(toValues(form));
  if (!parsed.success) {
    return invalid("Check the copy details.", fieldErrors(parsed.error));
  }
  const input = parsed.data;

  const book = await getBook(input.bookId);
  if (!book) return invalid("That title is no longer in the catalogue.", { bookId: ["Title not found."] });

  const supabase = await createClient();
  const { rows, error } = await insertCopies(supabase, {
    bookId: input.bookId,
    accessionNumber: book.accession_number,
    count: input.count,
    shelfLocation: input.shelfLocation ?? null,
    condition: input.condition,
    acquisitionPrice: input.acquisitionPrice ?? null,
  });

  if (error) {
    const friendly = uniqueViolation(error);
    return invalid(friendly ?? "The copies could not be registered.", {
      accessionNumber: [friendly ?? error.message ?? "The copies could not be registered."],
    });
  }

  await writeAudit("catalogue.copies_added", "book", input.bookId, {
    accession_number: book.accession_number,
    added: rows.length,
    barcodes: rows.map((copy) => copy.barcode),
  });
  revalidateCatalogue(input.bookId, rows[0]?.barcode);

  return {
    ok: true,
    data: { bookId: input.bookId, copies: rows.length },
    message: `${rows.length} cop${rows.length === 1 ? "y" : "ies"} accessioned under ${book.accession_number}. Book cards and QR labels are ready to print.`,
  };
}

export async function updateCopy(
  _prev: ActionResult | null,
  form: FormData,
): Promise<ActionResult<{ copyId: string; barcode: string }>> {
  await guardRole("librarian", "admin");

  const parsed = copyUpdateSchema.safeParse(toValues(form));
  if (!parsed.success) {
    return invalid("Check the copy details.", fieldErrors(parsed.error));
  }
  const input = parsed.data;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("book_copies")
    .update({
      status: input.status,
      condition: input.condition?.trim() || "Good",
      shelf_location: input.shelfLocation?.trim() || null,
      notes: input.notes?.trim() || null,
    })
    .eq("id", input.copyId)
    .select("id, barcode, book_id")
    .single();

  if (error || !data) {
    return invalid("That copy could not be updated.", { form: [error?.message ?? "Copy not found."] });
  }

  const copy = data as unknown as { id: string; barcode: string; book_id: string };
  await writeAudit("catalogue.copy_updated", "book_copy", copy.id, {
    barcode: copy.barcode,
    status: input.status,
    shelf_location: input.shelfLocation ?? null,
  });
  revalidateCatalogue(copy.book_id, copy.barcode);

  return {
    ok: true,
    data: { copyId: copy.id, barcode: copy.barcode },
    message: `Copy ${copy.barcode} saved.`,
  };
}

/** Re-issues the digital book card (and its QR payload) for an existing copy. */
export async function regenerateCard(
  _prev: ActionResult | null,
  form: FormData,
): Promise<ActionResult<{ copyId: string; barcode: string }>> {
  await guardRole("librarian", "admin");

  const values = toValues(form);
  const parsed = z
    .object({ copyId: z.string().uuid("Missing copy reference") })
    .safeParse({ copyId: values.copyId });
  if (!parsed.success) return invalid("Missing copy reference.", { copyId: ["Missing copy reference."] });

  const supabase = await createClient();
  const { data: copy } = await supabase
    .from("book_copies")
    .select("id, barcode, accession_number, book_id")
    .eq("id", parsed.data.copyId)
    .maybeSingle();
  if (!copy) return invalid("That copy is no longer registered.", { copyId: ["Copy not found."] });

  const item = copy as unknown as { id: string; barcode: string; accession_number: string | null; book_id: string };
  const book = (await getBook(item.book_id)) as CatalogueBook | null;
  if (!book) return invalid("The parent title is missing from the catalogue.", { copyId: ["Title not found."] });

  const existing = await listBookRecordByCopy(item.id);
  const payload = {
    book_id: item.book_id,
    copy_id: item.id,
    title: book.title,
    author: book.author,
    accession_number: item.accession_number ?? book.accession_number,
    call_number: book.call_number,
    qr_payload: copyUrl(item.barcode),
    qr_image_url: `/api/qr/${encodeURIComponent(item.barcode)}?size=512`,
    updated_at: new Date().toISOString(),
  };

  const { error } = existing
    ? await supabase.from("book_records").update(payload).eq("id", existing.id)
    : await supabase.from("book_records").insert(payload);

  if (error) return invalid("The book card could not be regenerated.", { form: [error.message] });

  await writeAudit("catalogue.card_regenerated", "book_record", item.id, {
    barcode: item.barcode,
    accession_number: payload.accession_number,
  });
  revalidateCatalogue(item.book_id, item.barcode);

  return {
    ok: true,
    data: { copyId: item.id, barcode: item.barcode },
    message: `Book card for ${item.barcode} regenerated.`,
  };
}

// ---------------------------------------------------------------------------
// Catalogue module contract
//
// These are the names the catalogue pages, dialogs and the inventory ledger
// import. `ActionResult<any>` in the data slot is deliberate: `useFormAction()`
// accepts `(prev: ActionResult | null, form: FormData) => Promise<ActionResult>`
// and a concrete payload generic is not assignable to `ActionResult<undefined>`.
// The interfaces below document what each action really returns; client leaves
// read them back through the result interfaces below.
// ---------------------------------------------------------------------------

/**
 * Loose envelope accepted by `useFormAction()` and `useCatalogAction()`, whose
 * payload slot is the bare `ActionResult`. Every wrapper resolves to one of the
 * interfaces below, so the untyped slot is confined to this single alias.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- documented bridge for the untyped action payload slot
type LooseActionResult = ActionResult<any>;

export interface AccessionResult {
  bookId: string;
  copies: number;
}

export interface BookIdResult {
  bookId: string;
}

export interface PublishResult extends BookIdResult {
  isPublished: boolean;
}

export interface CopyResult {
  copyId: string;
  barcode: string;
}

export interface BulkCopyResult {
  updated: number;
  status: CopyStatus;
}

/** Copy statuses a librarian may set from the desk. Mirrors the `copy_status` enum. */
export const DESK_COPY_STATUSES = [
  "available",
  "borrowed",
  "reserved",
  "damaged",
  "lost",
  "maintenance",
] as const satisfies readonly CopyStatus[];

/** Publish (show in OPAC) or withdraw a title. Never deletes holdings. */
export async function setBookPublishAction(
  _prev: LooseActionResult | null,
  form: FormData,
): Promise<LooseActionResult> {
  await guardRole("librarian", "admin");

  const parsed = z
    .object({ id: z.string().uuid("Missing title reference"), isPublished: booleanField })
    .safeParse(toValues(form));
  if (!parsed.success) return invalid("Check the publication state.", fieldErrors(parsed.error));
  const { id, isPublished } = parsed.data;

  const book = await getBook(id);
  if (!book) return invalid("That title is no longer in the catalogue.", { id: ["Title not found."] });
  if (book.is_published === isPublished) {
    return {
      ok: true,
      data: { bookId: id, isPublished } satisfies PublishResult,
      message: `“${book.title}” is already ${isPublished ? "published" : "withdrawn"}.`,
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("books").update({ is_published: isPublished }).eq("id", id);
  if (error) return invalid("The publication state could not be saved.", { form: [error.message] });

  await writeAudit(isPublished ? "catalogue.title_published" : "catalogue.title_withdrawn", "book", id, {
    accession_number: book.accession_number,
    title: book.title,
    copies: book.total_copies,
    is_published: isPublished,
  });
  revalidateCatalogue(id, book.accession_number);

  return {
    ok: true,
    data: { bookId: id, isPublished } satisfies PublishResult,
    message: isPublished
      ? `“${book.title}” is published and searchable in the OPAC.`
      : `“${book.title}” is withdrawn from the public catalogue. Its ${book.total_copies} copy(ies) stay on the inventory ledger.`,
  };
}

/** Withdraws a title from the public catalogue without touching its holdings. */
export async function archiveBookAction(
  prev: LooseActionResult | null,
  form: FormData,
): Promise<LooseActionResult> {
  return archiveBook(prev, form);
}

export async function deleteBookAction(
  prev: LooseActionResult | null,
  form: FormData,
): Promise<LooseActionResult> {
  return deleteBook(prev, form);
}

export async function addCopiesAction(
  prev: LooseActionResult | null,
  form: FormData,
): Promise<LooseActionResult> {
  return addCopies(prev, form);
}

export async function updateCopyAction(
  prev: LooseActionResult | null,
  form: FormData,
): Promise<LooseActionResult> {
  return updateCopy(prev, form);
}

export async function regenerateCardAction(
  prev: LooseActionResult | null,
  form: FormData,
): Promise<LooseActionResult> {
  return regenerateCard(prev, form);
}

/**
 * Inventory bulk edit: applies one status (and optionally a shelf location) to
 * every selected copy, then lets the database recompute each affected title's
 * availability counters.
 */
export async function bulkUpdateCopiesAction(
  _prev: LooseActionResult | null,
  form: FormData,
): Promise<LooseActionResult> {
  await guardRole("librarian", "admin");

  const copyIds = form
    .getAll("copyIds")
    .filter((value): value is string => typeof value === "string" && value.length > 0);
  const shelfLocation = String(form.get("shelfLocation") ?? "").trim();

  const parsed = z
    .object({
      copyIds: z
        .array(z.string().uuid("One of the selected copies is not a valid reference"))
        .min(1, "Select at least one copy")
        .max(200, "Bulk updates are capped at 200 copies"),
      status: z.enum(DESK_COPY_STATUSES),
      shelfLocation: z.string().max(120).optional(),
    })
    .safeParse({ copyIds, status: form.get("status"), shelfLocation: shelfLocation || undefined });
  if (!parsed.success) return invalid("Bulk update failed.", fieldErrors(parsed.error));
  const input = parsed.data;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("book_copies")
    .update({
      status: input.status,
      ...(input.shelfLocation ? { shelf_location: input.shelfLocation } : null),
    })
    .in("id", input.copyIds)
    .select("id, barcode, book_id");

  if (error) return invalid("The selected copies could not be updated.", { form: [error.message] });

  const rows = (data ?? []) as unknown as { id: string; barcode: string; book_id: string }[];
  if (rows.length === 0) return invalid("Those copies are no longer registered.", {
    copyIds: ["Copies not found."],
  });

  const bookIds = Array.from(new Set(rows.map((row) => row.book_id)));
  for (const bookId of bookIds) await supabase.rpc("refresh_book_counters", { p_book_id: bookId });

  await writeAudit("catalogue.copies_bulk_status", "book_copy", rows[0]?.id ?? null, {
    status: input.status,
    updated: rows.length,
    titles: bookIds.length,
    barcodes: rows.map((row) => row.barcode).slice(0, 40),
    shelf_location: input.shelfLocation ?? null,
  });
  for (const bookId of bookIds) revalidateCatalogue(bookId);

  return {
    ok: true,
    data: { updated: rows.length, status: input.status } satisfies BulkCopyResult,
    message: `${rows.length} cop${rows.length === 1 ? "y" : "ies"} marked ${input.status.replace("_", " ")}. Availability counts refreshed.`,
  };
}
