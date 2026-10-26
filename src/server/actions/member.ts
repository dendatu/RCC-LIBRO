"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { isSeniorHighLevel } from "@/lib/constants";
import { getMember } from "@/lib/rbac";
import { createClient } from "@/lib/supabase/server";
import { fieldErrors, profileSchema, reservationSchema } from "@/lib/validators";
import { formatPeso } from "@/lib/utils";
import type { ActionResult, CirculationSection } from "@/lib/types";

/** Serialises FormData entries into a flat object for zod. */
function payloadFrom(form: FormData): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  for (const [key, value] of form.entries()) payload[key] = value;
  return payload;
}

async function audit(
  client: Awaited<ReturnType<typeof createClient>>,
  action: string,
  entityType: string,
  entityId: string | null,
  metadata: Record<string, unknown>,
) {
  await client.rpc("write_audit", {
    p_action: action,
    p_entity_type: entityType,
    p_entity_id: entityId,
    p_metadata: metadata,
  });
}

const blank = (value?: string | null) => {
  const trimmed = typeof value === "string" ? value.trim() : "";
  return trimmed.length > 0 ? trimmed : null;
};

// ---------------------------------------------------------------------------
// Profile / classification onboarding
// ---------------------------------------------------------------------------

export async function updateProfile(
  _prev: ActionResult | null,
  form: FormData,
): Promise<ActionResult> {
  const member = await getMember();
  if (!member) return { ok: false, message: "Your session expired. Please sign in again." };

  const parsed = profileSchema.safeParse(payloadFrom(form));
  if (!parsed.success) {
    return {
      ok: false,
      message: "Please correct the highlighted fields.",
      errors: fieldErrors(parsed.error),
    };
  }

  const data = parsed.data;
  const isStudent = data.borrowerType === "student";
  const seniorHigh = isSeniorHighLevel(data.educationLevel);

  const classification = {
    borrower_type: data.borrowerType,
    education_level: isStudent ? (data.educationLevel ?? null) : null,
    senior_high_track: isStudent && seniorHigh ? (data.seniorHighTrack ?? null) : null,
    college_program: isStudent ? (data.collegeProgram ?? null) : null,
    faculty_department: isStudent ? null : (data.facultyDepartment ?? null),
    section: isStudent ? blank(data.section) : null,
    id_number: blank(data.idNumber),
    sbtr_number: blank(data.sbtrNumber),
    enrollment_year: data.enrollmentYear ?? null,
  };

  const supabase = await createClient();
  const fullName = data.fullName.trim();
  const contact = blank(data.contactNumber);

  if (classification.sbtr_number) {
    const { data: taken } = await supabase
      .from("profiles")
      .select("user_id")
      .eq("sbtr_number", classification.sbtr_number)
      .neq("user_id", member.user.id)
      .maybeSingle();
    if (taken) {
      return {
        ok: false,
        message: "That SBTR number is already registered to another member.",
        errors: { sbtrNumber: ["Ask the circulation desk to confirm your SBTR number."] },
      };
    }
  }

  const { error: userError } = await supabase
    .from("users")
    .update({ full_name: fullName, contact_number: contact })
    .eq("id", member.user.id);
  if (userError) {
    return { ok: false, message: "Could not save your contact details. Please try again." };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .upsert({ user_id: member.user.id, ...classification }, { onConflict: "user_id" })
    .select("id")
    .maybeSingle();

  if (profileError) {
    return {
      ok: false,
      message: "The desk has not verified part of that classification yet. Please see a librarian.",
    };
  }

  await audit(
    supabase,
    "member.profile_update",
    "profile",
    (profile?.id as string | undefined) ?? member.user.id,
    {
      borrower_type: classification.borrower_type,
      education_level: classification.education_level,
      college_program: classification.college_program,
      faculty_department: classification.faculty_department,
      sbtr_number: classification.sbtr_number,
    },
  );

  revalidatePath("/dashboard/profile");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/sbtr");
  revalidatePath("/dashboard/card");

  return {
    ok: true,
    message: isStudent
      ? "Profile saved. The desk matches your SBTR number before releasing loans."
      : "Profile saved. Faculty loans are issued against your department ID.",
  };
}

// ---------------------------------------------------------------------------
// Reservations
// ---------------------------------------------------------------------------

export async function reserveBook(
  _prev: ActionResult | null,
  form: FormData,
): Promise<ActionResult> {
  const member = await getMember();
  if (!member) return { ok: false, message: "Your session expired. Please sign in again." };

  const parsed = reservationSchema.safeParse(payloadFrom(form));
  if (!parsed.success) {
    return { ok: false, message: "Unknown title.", errors: fieldErrors(parsed.error) };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("reserve_book", {
    p_book_id: parsed.data.bookId,
    p_borrower_id: member.user.id,
  });

  const result = (data ?? {}) as {
    ok?: boolean;
    code?: string;
    message?: string;
    queue_position?: number;
    reservation_id?: string;
  };

  if (error || result.ok === false) {
    return {
      ok: false,
      code: result.code,
      message:
        result.message ??
        "The desk could not add that title to your queue. It may be a library-use-only title.",
    };
  }

  revalidatePath("/dashboard/reservations");
  revalidatePath("/dashboard/catalog");
  revalidatePath("/dashboard");

  return {
    ok: true,
    message:
      typeof result.queue_position === "number"
        ? `Reserved — you are number ${result.queue_position} in the queue.`
        : "Reserved. Watch your reservations for a hold.",
  };
}

const reservationIdSchema = z.object({ reservationId: z.string().uuid() });

export async function cancelReservation(
  _prev: ActionResult | null,
  form: FormData,
): Promise<ActionResult> {
  const member = await getMember();
  if (!member) return { ok: false, message: "Your session expired. Please sign in again." };

  const parsed = reservationIdSchema.safeParse(payloadFrom(form));
  if (!parsed.success) return { ok: false, message: "That reservation is not valid." };

  const supabase = await createClient();
  const { data: mine } = await supabase
    .from("reservations")
    .select("id, status")
    .eq("id", parsed.data.reservationId)
    .eq("borrower_id", member.user.id)
    .maybeSingle();

  if (!mine) return { ok: false, message: "That reservation is not yours." };

  const { data, error } = await supabase.rpc("cancel_reservation", {
    p_reservation_id: parsed.data.reservationId,
  });
  const result = (data ?? {}) as { ok?: boolean; code?: string; message?: string };

  if (error || result.ok === false) {
    return {
      ok: false,
      code: result.code,
      message: result.message ?? "This reservation can no longer be cancelled — see the desk.",
    };
  }

  await audit(supabase, "member.reservation_cancel", "reservation", parsed.data.reservationId, {
    previous_status: mine.status,
  });

  revalidatePath("/dashboard/reservations");
  revalidatePath("/dashboard");

  return { ok: true, message: "Reservation cancelled. The queue moved up." };
}

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

const notificationIdSchema = z.object({ notificationId: z.coerce.number().int().positive() });

export async function markNotificationRead(
  _prev: ActionResult | null,
  form: FormData,
): Promise<ActionResult> {
  const member = await getMember();
  if (!member) return { ok: false, message: "Your session expired. Please sign in again." };

  const parsed = notificationIdSchema.safeParse(payloadFrom(form));
  if (!parsed.success) return { ok: false, message: "Unknown notification." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("notifications")
    .update({ is_read: true, read_at: new Date().toISOString() })
    .eq("id", parsed.data.notificationId)
    .eq("user_id", member.user.id);

  if (error) return { ok: false, message: "Could not mark that notification as read." };

  revalidatePath("/dashboard/notifications");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function markAllNotificationsRead(
  _prev: ActionResult | null,
  _form: FormData,
): Promise<ActionResult> {
  const member = await getMember();
  if (!member) return { ok: false, message: "Your session expired. Please sign in again." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("notifications")
    .update({ is_read: true, read_at: new Date().toISOString() })
    .eq("user_id", member.user.id)
    .eq("is_read", false)
    .select("id");

  if (error) return { ok: false, message: "Could not update your notifications." };

  await audit(supabase, "member.notifications_read_all", "notification", null, {
    count: (data ?? []).length,
  });

  revalidatePath("/dashboard/notifications");
  revalidatePath("/dashboard");
  return { ok: true, message: "All caught up." };
}

// ---------------------------------------------------------------------------
// Fine estimator (read-only, uses the database policy engine)
// ---------------------------------------------------------------------------

const estimateSchema = z.object({ transactionId: z.string().uuid() });

export interface FineEstimateResult {
  ok: boolean;
  amount: number;
  formatted: string;
  message: string;
}

export async function requestFineEstimate(input: {
  transactionId: string;
}): Promise<FineEstimateResult> {
  const failure = {
    ok: false,
    amount: 0,
    formatted: formatPeso(0),
    message: "That loan is no longer open, so the desk cannot estimate it.",
  } satisfies FineEstimateResult;

  const member = await getMember();
  if (!member) return failure;

  const parsed = estimateSchema.safeParse(input ?? {});
  if (!parsed.success) return failure;

  const supabase = await createClient();
  const { data: loan } = await supabase
    .from("borrow_transactions")
    .select("id, section, due_date, status")
    .eq("id", parsed.data.transactionId)
    .eq("borrower_id", member.user.id)
    .in("status", ["active", "overdue"])
    .maybeSingle();

  if (!loan) return failure;

  const { data } = await supabase.rpc("calculate_fine", {
    p_section: loan.section as CirculationSection,
    p_due_date: loan.due_date,
    p_as_of: new Date().toISOString(),
  });

  const amount = Number(data ?? 0);
  return {
    ok: true,
    amount,
    formatted: formatPeso(amount),
    message:
      amount > 0
        ? `Accrued so far: ${formatPeso(amount)} — the desk confirms the exact figure at check-in.`
        : "Nothing accrued yet. This loan is still within its due window.",
  };
}
