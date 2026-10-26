"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getMember, isStaff } from "@/lib/rbac";
import { createClient } from "@/lib/supabase/server";
import { fieldErrors, reservationSchema } from "@/lib/validators";
import type { ActionResult, ReservationStatus } from "@/lib/types";
import { writeAudit } from "@/server/data/catalog";

/** Every circulation RPC returns a jsonb envelope of this shape. */
interface RpcEnvelope {
  ok?: boolean;
  code?: string;
  message?: string;
  reservation_id?: string;
  queue_position?: number;
  copy_id?: string;
  copy_status?: string;
  reference_no?: string;
}

const uuidField = z.string().uuid("That reference is not valid.");

const cancelSchema = z.object({ reservationId: uuidField });

const notifySchema = z.object({ reservationId: uuidField });

const fulfilSchema = z.object({
  reservationId: uuidField,
  barcode: z.string().trim().max(64).optional().or(z.literal("")),
});

function denied(message: string): ActionResult {
  return { ok: false, message };
}

function revalidateReservations() {
  for (const path of [
    "/dashboard",
    "/dashboard/reservations",
    "/dashboard/requests",
    "/dashboard/notifications",
    "/dashboard/borrowings",
    "/dashboard/penalties",
  ]) {
    revalidatePath(path);
  }
}

/** Places a hold on a title for the signed-in member (RLS funnels this through `reserve_book`). */
export async function reserveAction(
  _prev: ActionResult | null,
  form: FormData,
): Promise<ActionResult> {
  const member = await getMember();
  if (!member) return denied("Sign in to reserve a title.");

  const parsed = reservationSchema.safeParse({ bookId: form.get("bookId") });
  if (!parsed.success) {
    return denied("Pick a title from the catalogue before reserving.");
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("reserve_book", {
    p_book_id: parsed.data.bookId,
    p_borrower_id: member.user.id,
  });

  if (error) return denied("The reservation could not be placed. Please try again.");

  const result = (data ?? {}) as RpcEnvelope;
  revalidateReservations();

  if (result.ok === true) {
    const position = Number(result.queue_position ?? 0);
    return {
      ok: true,
      code: "queued",
      message:
        position > 1
          ? `You are number ${position} in the queue — we will notify you when a copy frees up.`
          : "A copy is reserved for you. Present this at the circulation desk.",
    };
  }

  return { ok: false, code: result.code, message: result.message ?? "The reservation could not be placed." };
}

/** Cancels a hold. Members cancel their own queue slot; staff may release any hold. */
export async function cancelReservationAction(
  _prev: ActionResult | null,
  form: FormData,
): Promise<ActionResult> {
  const member = await getMember();
  if (!member) return denied("Sign in to manage reservations.");

  const parsed = cancelSchema.safeParse({ reservationId: form.get("reservationId") });
  if (!parsed.success) return denied("That reservation could not be found.");

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("cancel_reservation", {
    p_reservation_id: parsed.data.reservationId,
  });

  if (error) return denied("The reservation could not be cancelled. Please try again.");

  const result = (data ?? {}) as RpcEnvelope;
  revalidateReservations();

  if (result.ok === true) {
    return { ok: true, message: "Reservation cancelled. The next member in line has been promoted." };
  }

  return {
    ok: false,
    code: result.code,
    message:
      result.message ??
      (result.code === "forbidden"
        ? "You can only cancel your own reservations."
        : result.code === "closed"
          ? "That reservation is already closed."
          : "That reservation could not be cancelled."),
  };
}

/**
 * Desk action: tells a queued member their hold is ready to collect. This writes
 * an in-app notification only — outbound e-mail is journaled by the scheduled
 * reminder job, never sent from the browser.
 */
export async function notifyReservationAction(
  _prev: ActionResult | null,
  form: FormData,
): Promise<ActionResult> {
  const member = await getMember();
  if (!member) return denied("Sign in to manage reservations.");
  if (!isStaff(member)) return denied("Only library staff can notify members.");

  const parsed = notifySchema.safeParse({ reservationId: form.get("reservationId") });
  if (!parsed.success) return denied("That reservation could not be found.");

  const supabase = await createClient();
  const { data: reservation } = await supabase
    .from("reservations")
    .select("id, status, borrower_id, book:books(title)")
    .eq("id", parsed.data.reservationId)
    .maybeSingle();

  if (!reservation) return denied("That reservation is no longer in the queue.");

  const row = reservation as unknown as {
    id: string;
    status: ReservationStatus;
    borrower_id: string;
    book: { title: string } | null;
  };

  if (row.status !== "waiting" && row.status !== "ready") {
    return denied(`This hold is already ${row.status}.`);
  }

  const title = row.book?.title ?? "a reserved title";
  const { error } = await supabase.from("notifications").insert({
    user_id: row.borrower_id,
    type: "reservation_ready",
    title: `Your hold is ready: ${title}`,
    body: "Present yourself at the circulation desk to collect the reserved copy.",
    link: "/dashboard/reservations",
  });

  if (error) return denied("The member could not be notified. Please try again.");

  await writeAudit("reservation.notified", "reservation", row.id, {
    title,
    borrower_id: row.borrower_id,
    actor: member.user.full_name,
  });
  revalidateReservations();

  return { ok: true, message: `Notified the member that “${title}” is ready at the desk.` };
}

/**
 * Hands a ready hold over at the desk. Opens the loan through `borrow_book`
 * (the only sanctioned issue path) and, once the loan exists, flips the
 * reservation to `fulfilled`. Any rejection from the loan RPC is surfaced
 * verbatim so the desk sees why the copy could not leave the shelf.
 */
export async function fulfilReservationAction(
  _prev: ActionResult | null,
  form: FormData,
): Promise<ActionResult> {
  const member = await getMember();
  if (!member) return denied("Sign in to manage reservations.");
  if (!isStaff(member)) return denied("Only library staff can release a reservation.");

  const parsed = fulfilSchema.safeParse({
    reservationId: form.get("reservationId"),
    barcode: form.get("barcode") ?? "",
  });
  if (!parsed.success) {
    return { ok: false, message: "Check the fields on the hold.", errors: fieldErrors(parsed.error) };
  }

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("reservations")
    .select("id, status, book_id, borrower_id, book:books(title)")
    .eq("id", parsed.data.reservationId)
    .maybeSingle();

  if (!existing) return denied("That reservation is no longer in the queue.");

  const reservation = existing as unknown as {
    id: string;
    status: ReservationStatus;
    book_id: string;
    borrower_id: string;
    book: { title: string } | null;
  };

  if (reservation.status !== "ready") {
    return denied(
      reservation.status === "waiting"
        ? "This member is still queued — the copy is not on hold for them yet."
        : `This hold is already ${reservation.status}.`,
    );
  }

  // Resolve the physical copy to hand over: the scanned barcode if given,
  // otherwise the first available copy of the title.
  let copyId: string | null = null;
  const barcode = parsed.data.barcode?.trim();
  if (barcode) {
    const { data: copy } = await supabase
      .from("book_copies")
      .select("id, status, book_id")
      .eq("barcode", barcode)
      .maybeSingle();
    if (!copy) return denied("No copy matches that barcode.");
    const found = copy as unknown as { id: string; status: string; book_id: string };
    if (found.book_id !== reservation.book_id) {
      return denied("That copy belongs to a different title than the reservation.");
    }
    copyId = found.id;
  } else {
    const { data: copies } = await supabase
      .from("book_copies")
      .select("id")
      .eq("book_id", reservation.book_id)
      .eq("status", "available")
      .limit(1);
    const first = (copies ?? [])[0] as unknown as { id: string } | undefined;
    if (!first) {
      return denied("No copy is on the shelf to hand over. Keep the member queued until one is returned.");
    }
    copyId = first.id;
  }

  const { data: borrowData, error: borrowError } = await supabase.rpc("borrow_book", {
    p_borrower_id: reservation.borrower_id,
    p_copy_id: copyId,
  });

  if (borrowError) return denied("The loan could not be opened. Please try again.");

  const borrow = (borrowData ?? {}) as RpcEnvelope;
  if (borrow.ok !== true) {
    return { ok: false, code: borrow.code, message: borrow.message ?? "The loan could not be opened." };
  }

  const { error: updateError } = await supabase
    .from("reservations")
    .update({ status: "fulfilled", fulfilled_at: new Date().toISOString(), copy_id: borrow.copy_id ?? copyId })
    .eq("id", reservation.id);

  if (updateError) {
    // The loan opened but the hold flag failed — tell the desk so they can reconcile.
    return {
      ok: true,
      message: `Loan issued to the member, but the hold could not be marked fulfilled. Close it from the queue.`,
    };
  }

  await writeAudit("reservation.fulfilled", "reservation", reservation.id, {
    book_id: reservation.book_id,
    borrower_id: reservation.borrower_id,
    copy_id: copyId,
    reference_no: borrow.reference_no ?? null,
    actor: member.user.full_name,
  });
  revalidateReservations();

  return { ok: true, message: `“${reservation.book?.title ?? "Title"}” handed over and the hold closed.` };
}
