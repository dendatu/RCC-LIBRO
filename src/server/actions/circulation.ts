"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { isSeniorHighLevel } from "@/lib/constants";
import { guardRole } from "@/lib/rbac";
import { createClient } from "@/lib/supabase/server";
import {
  borrowSchema,
  extendSchema,
  fieldErrors,
  fineActionSchema,
  profileSchema,
  returnSchema,
  userAdminSchema,
} from "@/lib/validators";
import type { ActionResult, CirculationSection, ReturnCondition, RoleSlug } from "@/lib/types";
import { formatDate, formatDateTime, formatPeso } from "@/lib/utils";
import {
  evaluateEligibility,
  getLoan,
  previewDueDate,
  previewFine,
  resolveDeskCopy,
  searchBorrowersForDesk,
  searchOpenLoans,
  writeAudit,
  type BorrowerOption,
  type DeskCopy,
  type DeskLoan,
  type EligibilityResult,
} from "@/server/data/circulation";

export interface CopyLookup {
  copy: DeskCopy;
  /** Due date if the loan were released right now (Postgres-computed). */
  dueDate: string;
}

export interface BorrowReceipt {
  transactionId: string;
  referenceNo: string;
  title: string;
  author: string;
  borrowerName: string;
  barcode: string | null;
  accessionNumber: string;
  section: CirculationSection;
  dueDate: string;
  issuedAt: string;
}

export interface ReturnOutcome {
  transactionId: string;
  referenceNo: string;
  title: string;
  borrowerName: string;
  condition: ReturnCondition;
  fine: number;
  overdueDays: number;
  overdueHours: number;
  copyStatus: string;
}

/** FormData drops empty strings so `z.coerce` and enum fields never see "". */
function toValues(form: FormData): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  for (const [key, value] of form.entries()) {
    if (typeof value !== "string") continue;
    const trimmed = value.trim();
    if (!trimmed) continue;
    payload[key] = trimmed;
  }
  return payload;
}

async function staffOnly<T>(roles: RoleSlug[], work: () => Promise<ActionResult<T>>): Promise<ActionResult<T>> {
  try {
    await guardRole(...roles);
  } catch {
    return { ok: false, message: "Only library staff can use the circulation desk." };
  }
  return work();
}

type RpcPayload = Record<string, unknown> | null;

function messageOf(payload: RpcPayload, fallback: string) {
  const value = payload?.message;
  return typeof value === "string" && value.trim() ? value : fallback;
}

function codeOf(payload: RpcPayload) {
  const value = payload?.code;
  return typeof value === "string" ? value : undefined;
}

/** `details` carries the eligibility reasons straight from Postgres. */
function detailsOf(payload: RpcPayload): { code: string; message: string }[] {
  const raw = payload?.details;
  if (!Array.isArray(raw)) return [];
  return raw.map((item) => ({
    code: String((item as Record<string, unknown>).code ?? "reason"),
    message: String((item as Record<string, unknown>).message ?? ""),
  }));
}

function reasonErrors(reasons: { code: string; message: string }[]): Record<string, string[]> {
  if (!reasons.length) return {};
  return { eligibility: reasons.map((reason) => reason.message) };
}

function revalidateDesk() {
  revalidatePath("/dashboard/circulation");
  revalidatePath("/dashboard/returns");
  revalidatePath("/dashboard/members");
  revalidatePath("/dashboard/fines");
  revalidatePath("/dashboard/requests");
  revalidatePath("/dashboard");
}

// ---------------------------------------------------------------------------
// Read helpers used by the desk UI
// ---------------------------------------------------------------------------

export async function lookupCopy(term: string): Promise<ActionResult<CopyLookup>> {
  return staffOnly(["librarian", "admin"], async () => {
    const clean = typeof term === "string" ? term.trim() : "";
    if (clean.length < 3) {
      return { ok: false, message: "Scan a copy label or type at least three characters." };
    }
    const copy = await resolveDeskCopy(clean);
    if (!copy) {
      return { ok: false, message: `No copy or accession matches “${clean}”. Check the label and try again.` };
    }
    const dueDate = await previewDueDate(copy.section, null);
    if (!dueDate) {
      return { ok: false, message: "The loan period for this section could not be read." };
    }
    return { ok: true, data: { copy, dueDate }, message: copy.title };
  });
}

/** Re-runs the Postgres due-date rule when the desk overrides the loan period. */
export async function refreshDuePreview(
  section: CirculationSection,
  days?: number | null,
): Promise<ActionResult<{ dueDate: string }>> {
  return staffOnly(["librarian", "admin"], async () => {
    const dueDate = await previewDueDate(section, days ?? null);
    if (!dueDate) return { ok: false, message: "The due-date rule for this section could not be read." };
    return { ok: true, data: { dueDate } };
  });
}

export async function searchBorrowers(term: string): Promise<ActionResult<BorrowerOption[]>> {
  return staffOnly(["librarian", "admin"], async () => {
    const rows = await searchBorrowersForDesk(typeof term === "string" ? term : "");
    return { ok: true, data: rows };
  });
}

/** Desk search over open loans: copy barcode, accession, reference or borrower. */
export async function searchDeskLoans(term: string): Promise<ActionResult<DeskLoan[]>> {
  return staffOnly(["librarian", "admin"], async () => {
    const clean = typeof term === "string" ? term.trim() : "";
    if (!clean) return { ok: false, message: "Scan a label or type a reference number." };
    const loans = await searchOpenLoans(clean);
    return {
      ok: true,
      data: loans,
      message: loans.length
        ? `${loans.length} open loan(s) match “${clean}”.`
        : `No open loan matches “${clean}”. The copy may already be checked in.`,
    };
  });
}

export async function checkEligibility(userId: string): Promise<ActionResult<EligibilityResult>> {
  return staffOnly(["librarian", "admin"], async () => {
    const parsed = z.string().uuid().safeParse(userId);
    if (!parsed.success) return { ok: false, message: "Select a borrower first." };
    const result = await evaluateEligibility(parsed.data);
    if (!result) return { ok: false, message: "That borrower account could not be read." };
    return { ok: true, data: result };
  });
}

/** Fine preview for the return desk and the calculator — always from Postgres. */
export async function previewFineForLoan(
  transactionId: string,
  asOf?: string,
): Promise<ActionResult<{ fine: number; loan: DeskLoan }>> {
  return staffOnly(["librarian", "admin"], async () => {
    const id = z.string().uuid().safeParse(transactionId);
    if (!id.success) return { ok: false, message: "Select an open loan first." };
    const loan = await getLoan(id.data);
    if (!loan) return { ok: false, message: "That loan is no longer on the ledger." };

    const stamp = asOf && !Number.isNaN(new Date(asOf).getTime()) ? new Date(asOf) : new Date();
    if (stamp.getTime() < new Date(loan.date_borrowed).getTime()) {
      return { ok: false, message: "The check-up time cannot be earlier than the date borrowed." };
    }

    const fine = await previewFine(loan.section, loan.due_date, stamp.toISOString());
    if (fine === null) return { ok: false, message: "The fine rate could not be read from the policy table." };
    return { ok: true, data: { fine, loan } };
  });
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export async function issueBook(
  _prev: ActionResult<unknown> | null,
  form: FormData,
): Promise<ActionResult<BorrowReceipt>> {
  return staffOnly(["librarian", "admin"], async () => {
    const parsed = borrowSchema.safeParse(toValues(form));
    if (!parsed.success) {
      return { ok: false, message: "Check the issue form.", errors: fieldErrors(parsed.error) };
    }
    const { borrowerId, barcode, days, notes } = parsed.data;

    const supabase = await createClient();
    const { data, error } = await supabase.rpc("borrow_book", {
      p_borrower_id: borrowerId,
      p_barcode: barcode,
      p_days: days ?? null,
      p_notes: notes ?? null,
    });

    if (error) {
      return { ok: false, message: "The desk could not record this loan. Please try again.", code: "database" };
    }

    const payload = (data ?? null) as RpcPayload;
    if (!payload || payload.ok !== true) {
      const reasons = detailsOf(payload);
      return {
        ok: false,
        message: messageOf(payload, "This book could not be issued."),
        code: codeOf(payload),
        errors: reasonErrors(reasons),
      };
    }

    revalidateDesk();

    const transactionId = String(payload.transaction_id ?? "");
    const loan = transactionId ? await getLoan(transactionId) : null;
    return {
      ok: true,
      message: `${String(payload.title ?? "The book")} is now on loan.`,
      data: {
        transactionId,
        referenceNo: String(payload.reference_no ?? loan?.reference_no ?? ""),
        title: String(payload.title ?? loan?.book_title ?? ""),
        author: loan?.book_author ?? "",
        borrowerName: loan?.borrower_name ?? "",
        barcode: loan?.barcode ?? null,
        accessionNumber: loan?.accession_number ?? "",
        section: (payload.section as CirculationSection) ?? (loan?.section ?? "general"),
        dueDate: String(payload.due_date ?? loan?.due_date ?? ""),
        issuedAt: loan?.date_borrowed ?? new Date().toISOString(),
      },
    };
  });
}

export async function checkInBook(
  _prev: ActionResult<unknown> | null,
  form: FormData,
): Promise<ActionResult<ReturnOutcome>> {
  return staffOnly(["librarian", "admin"], async () => {
    const parsed = returnSchema.safeParse(toValues(form));
    if (!parsed.success) {
      return { ok: false, message: "Check the return details.", errors: fieldErrors(parsed.error) };
    }
    const { transactionId, condition, remarks } = parsed.data;

    const loan = await getLoan(transactionId);
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("return_book", {
      p_transaction_id: transactionId,
      p_condition: condition,
      p_remarks: remarks ?? null,
    });

    if (error) {
      return { ok: false, message: "The check-in could not be saved. Please try again.", code: "database" };
    }

    const payload = (data ?? null) as RpcPayload;
    if (!payload || payload.ok !== true) {
      return {
        ok: false,
        message: messageOf(payload, "This loan could not be closed."),
        code: codeOf(payload),
      };
    }

    revalidateDesk();

    const fine = Number(payload.fine ?? 0);
    const overdueDays = Number(payload.overdue_days ?? 0);
    return {
      ok: true,
      message:
        fine > 0
          ? `Checked in ${overdueDays} day(s) late — a fine of PHP ${fine.toFixed(2)} was assessed.`
          : condition === "lost"
            ? "Recorded as lost. The replacement penalty was raised against the borrower."
            : condition === "damaged"
              ? "Recorded as damaged. The repair penalty was raised against the borrower."
              : "Returned on time — no fine.",
      data: {
        transactionId,
        referenceNo: loan?.reference_no ?? "",
        title: loan?.book_title ?? "",
        borrowerName: loan?.borrower_name ?? "",
        condition,
        fine,
        overdueDays,
        overdueHours: Number(payload.overdue_hours ?? 0),
        copyStatus: String(payload.copy_status ?? "available"),
      },
    };
  });
}

export async function extendLoan(
  _prev: ActionResult | null,
  form: FormData,
): Promise<ActionResult> {
  return staffOnly(["librarian", "admin"], async () => {
    const parsed = extendSchema.safeParse(toValues(form));
    if (!parsed.success) {
      return { ok: false, message: "Check the extension length.", errors: fieldErrors(parsed.error) };
    }

    const supabase = await createClient();
    const { data, error } = await supabase.rpc("extend_due_date", {
      p_transaction_id: parsed.data.transactionId,
      p_days: parsed.data.days,
    });

    if (error) {
      return { ok: false, message: "The extension could not be saved. Please try again.", code: "database" };
    }

    const payload = (data ?? null) as RpcPayload;
    if (!payload || payload.ok !== true) {
      return { ok: false, message: messageOf(payload, "This loan cannot be extended."), code: codeOf(payload) };
    }

    const loan = await getLoan(parsed.data.transactionId);
    revalidateDesk();
    return {
      ok: true,
      message: `${loan?.reference_no ?? "Loan"} extended — now due ${formatDateTime(
        String(payload.due_date ?? loan?.due_date ?? ""),
      )}.`,
    };
  });
}

export async function settleFine(
  _prev: ActionResult | null,
  form: FormData,
): Promise<ActionResult> {
  return staffOnly(["librarian", "admin"], async () => {
    const parsed = fineActionSchema.safeParse(toValues(form));
    if (!parsed.success) {
      return { ok: false, message: "Check the settlement details.", errors: fieldErrors(parsed.error) };
    }

    const supabase = await createClient();
    const { data, error } = await supabase.rpc("settle_fine", {
      p_fine_id: parsed.data.fineId,
      p_paid_via: parsed.data.paidVia,
    });

    if (error) {
      return { ok: false, message: "The payment could not be recorded. Please try again.", code: "database" };
    }

    const payload = (data ?? null) as RpcPayload;
    if (!payload || payload.ok !== true) {
      return { ok: false, message: messageOf(payload, "This penalty could not be settled."), code: codeOf(payload) };
    }

    revalidateDesk();
    return {
      ok: true,
      message: `Payment of ${formatPeso(Number(payload.amount ?? 0))} recorded against this penalty.`,
    };
  });
}

export async function waiveFine(
  _prev: ActionResult | null,
  form: FormData,
): Promise<ActionResult> {
  return staffOnly(["admin"], async () => {
    const parsed = fineActionSchema.safeParse(toValues(form));
    if (!parsed.success) {
      return { ok: false, message: "Check the waiver reason.", errors: fieldErrors(parsed.error) };
    }
    if (!parsed.data.reason || parsed.data.reason.trim().length < 5) {
      return { ok: false, message: "A waiver needs a written reason.", errors: { reason: ["Enter the reason for waiving this penalty."] } };
    }

    const supabase = await createClient();
    const { data, error } = await supabase.rpc("waive_fine", {
      p_fine_id: parsed.data.fineId,
      p_reason: parsed.data.reason,
    });

    if (error) {
      return { ok: false, message: "The waiver could not be recorded. Please try again.", code: "database" };
    }

    const payload = (data ?? null) as RpcPayload;
    if (!payload || payload.ok !== true) {
      return { ok: false, message: messageOf(payload, "Only an administrator may waive a penalty."), code: codeOf(payload) };
    }

    revalidateDesk();
    return { ok: true, message: "Penalty waived and written to the audit trail." };
  });
}

/**
 * Runs `mark_overdue_loans()`: late loans are flagged and their daily or hourly
 * fine is posted by the database. Idempotent, so the desk can call it freely.
 */
export async function sweepOverdue(): Promise<ActionResult> {
  return staffOnly(["librarian", "admin"], async () => {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("mark_overdue_loans");
    if (error) {
      return { ok: false, message: "The overdue check failed. Please try again.", code: "database" };
    }
    const marked = Number(data ?? 0);
    await writeAudit("circulation.overdue_sweep", "borrow_transaction", null, { marked });
    revalidateDesk();
    return {
      ok: true,
      message: marked > 0 ? `${marked} loan(s) marked overdue.` : "No loan changed state — everything is current.",
    };
  });
}

// ---------------------------------------------------------------------------
// Borrower record maintenance (classification, SBTR, entitlement)
// ---------------------------------------------------------------------------

const ROLE_RANK: Record<RoleSlug, number> = { borrower: 10, librarian: 20, admin: 30 };

export async function updateBorrowerRecord(
  _prev: ActionResult | null,
  form: FormData,
): Promise<ActionResult> {
  return staffOnly(["librarian", "admin"], async () => {
    const values = toValues(form);
    const userId = z.string().uuid().safeParse(values.userId);
    if (!userId.success) return { ok: false, message: "That borrower record is no longer valid." };

    const parsedProfile = profileSchema.safeParse(values);
    if (!parsedProfile.success) {
      return {
        ok: false,
        message: "Check the classification fields.",
        errors: fieldErrors(parsedProfile.error),
      };
    }

    const supabase = await createClient();
    const { data: roleRows } = await supabase.from("user_roles").select("role_slug").eq("user_id", userId.data);
    const held = ((roleRows ?? []) as { role_slug: RoleSlug }[]).map((row) => row.role_slug);
    const currentRole = held.reduce<RoleSlug>((best, slug) => (ROLE_RANK[slug] > ROLE_RANK[best] ? slug : best), "borrower");

    const parsedRecord = userAdminSchema.safeParse({
      ...values,
      userId: userId.data,
      role: currentRole,
    });
    if (!parsedRecord.success) {
      return {
        ok: false,
        message: "Check the entitlement fields.",
        errors: fieldErrors(parsedRecord.error),
      };
    }

    const classification = parsedProfile.data;
    const entitlement = parsedRecord.data;
    const isStudent = classification.borrowerType === "student";

    const profilePatch = {
      borrower_type: classification.borrowerType,
      education_level: isStudent ? (classification.educationLevel ?? null) : null,
      senior_high_track:
        isStudent && isSeniorHighLevel(classification.educationLevel)
          ? (classification.seniorHighTrack ?? null)
          : null,
      college_program: isStudent ? (classification.collegeProgram ?? null) : null,
      faculty_department: isStudent ? null : (classification.facultyDepartment ?? null),
      sbtr_number: classification.sbtrNumber?.trim() ? classification.sbtrNumber.trim() : null,
      id_number: classification.idNumber?.trim() ? classification.idNumber.trim() : null,
      section: classification.section?.trim() ? classification.section.trim() : null,
      enrollment_year: classification.enrollmentYear ?? null,
    };

    const { error: profileError } = await supabase
      .from("profiles")
      .update(profilePatch)
      .eq("user_id", userId.data);

    if (profileError) {
      if (profileError.code === "23505") {
        const field = /sbtr/i.test(profileError.message) ? "sbtrNumber" : "idNumber";
        const text = /sbtr/i.test(profileError.message)
          ? "That SBTR number is already assigned to another member."
          : "That ID number is already assigned to another member.";
        return { ok: false, message: text, errors: { [field]: [text] } };
      }
      if (profileError.code === "23514") {
        return {
          ok: false,
          message: "The classification is incomplete: students need a level or programme, faculty need a department.",
        };
      }
      if (profileError.code === "22P02") {
        return {
          ok: false,
          message:
            "That level or programme is not in the database yet — apply the latest schema migration before saving it.",
          code: "database",
        };
      }
      return { ok: false, message: "The borrower record could not be saved. Please try again.", code: "database" };
    }

    const { error: userError } = await supabase
      .from("users")
      .update({
        full_name: classification.fullName,
        contact_number: classification.contactNumber?.trim() ? classification.contactNumber.trim() : null,
        is_active: entitlement.isActive,
      })
      .eq("id", userId.data);

    if (userError) {
      return { ok: false, message: "The member account could not be updated. Please try again.", code: "database" };
    }

    const status = z
      .enum(["active", "suspended", "graduated", "inactive"])
      .safeParse(values.status ?? "active");

    const recordPatch: Record<string, unknown> = { borrowing_limit: entitlement.borrowingLimit ?? 3 };
    if (status.success) recordPatch.status = status.data;

    const { error: recordError } = await supabase
      .from("borrower_records")
      .update(recordPatch)
      .eq("user_id", userId.data);

    if (recordError) {
      return { ok: false, message: "The borrowing entitlement could not be saved.", code: "database" };
    }

    await supabase.rpc("refresh_borrower_record", { p_user_id: userId.data });

    await writeAudit("member.record_update", "user", userId.data, {
      borrower_type: profilePatch.borrower_type,
      sbtr_number: profilePatch.sbtr_number,
      borrowing_limit: recordPatch.borrowing_limit,
      is_active: entitlement.isActive,
      status: recordPatch.status ?? null,
    });

    revalidatePath("/dashboard/members");
    revalidatePath(`/dashboard/members/${userId.data}`);
    revalidateDesk();

    return { ok: true, message: "Borrower record updated." };
  });
}

// ---------------------------------------------------------------------------
// Reservation queue
// ---------------------------------------------------------------------------

const queueIdSchema = z.object({
  reservationId: z.string().uuid("Missing reservation reference"),
});

export async function markReservationReady(
  _prev: ActionResult | null,
  form: FormData,
): Promise<ActionResult> {
  return staffOnly(["librarian", "admin"], async () => {
    const values = toValues(form);
    const ids = queueIdSchema.safeParse(values);
    if (!ids.success) return { ok: false, message: "Select a reservation first.", errors: fieldErrors(ids.error) };

    const holdDays = z.coerce.number().int().min(1).max(14).safeParse(values.holdDays ?? "2");
    if (!holdDays.success) {
      return { ok: false, message: "Hold period must be between 1 and 14 days.", errors: { holdDays: ["Enter 1 to 14 days."] } };
    }

    const supabase = await createClient();
    const { data: existing } = await supabase
      .from("reservations")
      .select("id, status, borrower_id, book_id")
      .eq("id", ids.data.reservationId)
      .maybeSingle();

    if (!existing) return { ok: false, message: "That reservation is no longer in the queue." };
    if (existing.status !== "waiting" && existing.status !== "ready") {
      return { ok: false, message: `This reservation is already ${String(existing.status)}.` };
    }

    const heldUntil = new Date(Date.now() + holdDays.data * 86_400_000);
    const { data: updated, error } = await supabase
      .from("reservations")
      .update({ status: "ready", ready_at: new Date().toISOString(), held_until: heldUntil.toISOString() })
      .eq("id", ids.data.reservationId)
      .select("id, held_until")
      .maybeSingle();

    if (error || !updated) {
      return { ok: false, message: "The hold could not be placed on the shelf. Please try again.", code: "database" };
    }

    const { data: title } = await supabase.from("books").select("title").eq("id", existing.book_id).maybeSingle();

    await supabase.from("notifications").insert({
      user_id: existing.borrower_id,
      type: "reservation_ready",
      title: `Reservation ready: ${String(title?.title ?? "your title")}`,
      body: `Present yourself at the circulation desk. The hold expires ${heldUntil.toLocaleDateString("en-PH")}.`,
      link: "/dashboard/reservations",
    });

    await writeAudit("reservation.ready", "reservation", updated.id, {
      hold_days: holdDays.data,
      borrower_id: existing.borrower_id,
    });

    revalidatePath("/dashboard/requests");
    return {
      ok: true,
      message: `Moved to the hold shelf — reserve it for ${formatDate(String(updated.held_until))}.`,
    };
  });
}

export async function cancelReservation(
  _prev: ActionResult | null,
  form: FormData,
): Promise<ActionResult> {
  return staffOnly(["librarian", "admin"], async () => {
    const values = toValues(form);
    const ids = queueIdSchema.safeParse(values);
    if (!ids.success) return { ok: false, message: "Select a reservation first.", errors: fieldErrors(ids.error) };

    const reason = z.string().trim().min(3, "Give the borrower a reason").max(500).safeParse(values.reason ?? "");
    if (!reason.success) {
      return { ok: false, message: "A cancellation reason is required.", errors: { reason: ["Enter why this hold is released."] } };
    }

    const supabase = await createClient();
    const { data, error } = await supabase.rpc("cancel_reservation", { p_reservation_id: ids.data.reservationId });
    if (error) {
      return { ok: false, message: "The reservation could not be released. Please try again.", code: "database" };
    }

    const payload = (data ?? null) as RpcPayload;
    if (!payload || payload.ok !== true) {
      return { ok: false, message: messageOf(payload, "This reservation could not be released."), code: codeOf(payload) };
    }

    await supabase.from("reservations").update({ notes: reason.data }).eq("id", ids.data.reservationId);
    await writeAudit("reservation.cancel", "reservation", ids.data.reservationId, { reason: reason.data });

    revalidatePath("/dashboard/requests");
    return { ok: true, message: "Hold released and the queue renumbered." };
  });
}

// ---------------------------------------------------------------------------
// Thin aliases for the `(prev, form) => ActionResult` surface that the borrower
// self-service renewal control binds through `useFormAction`. Each delegates to
// the shared mutation above, so no rule is re-implemented here.
// ---------------------------------------------------------------------------

export async function extendAction(
  prev: ActionResult | null,
  form: FormData,
): Promise<ActionResult> {
  return extendLoan(prev, form);
}
