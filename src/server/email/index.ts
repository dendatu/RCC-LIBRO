import "server-only";
import { emailConfig, env } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { deliver } from "./provider";
import { renderTemplate, type EmailTemplate } from "./templates";

type LogClient = ReturnType<typeof createAdminClient> | null;

/**
 * Journaling needs the service role because `email_logs` is admin-only under RLS.
 * Without `SUPABASE_SERVICE_ROLE_KEY` the send still happens, but delivery is only
 * written to the server log — the app degrades instead of throwing.
 */
function journal(): LogClient {
  if (!env.SUPABASE_SERVICE_ROLE_KEY) return null;
  try {
    return createAdminClient();
  } catch {
    return null;
  }
}

export interface SendOptions {
  to: string;
  userId?: string | null;
  template: EmailTemplate;
  /** Idempotency guard, e.g. `reminder:3:<transaction id>`. */
  dedupeKey?: string;
  transactionId?: string | null;
  values: Record<string, string | number | undefined>;
}

export interface SendResult {
  ok: boolean;
  skipped?: "duplicate" | "not_configured";
  message: string;
  logId?: number;
}

/**
 * Resend's SDK hands back a plain `{ name, message, statusCode }` object rather
 * than an `Error`, so an `instanceof Error` test alone discards the provider's
 * reason — a rejected send used to surface as "Unknown provider error".
 */
function providerMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  const shaped = error as
    | { message?: string; statusCode?: number; error?: { message?: string } }
    | null
    | undefined;
  const reason = shaped?.message ?? shaped?.error?.message;
  if (reason) return shaped?.statusCode ? `${reason} (HTTP ${shaped.statusCode})` : reason;
  return `the provider refused the message${shaped?.statusCode ? ` (HTTP ${shaped.statusCode})` : ""}`;
}

/** Written into `email_logs.error` when a row is journalled instead of sent. */
function offlineReason() {
  return emailConfig.notice ?? "No mail transport configured (set MAIL_SMTP_* or RESEND_API_KEY).";
}

export async function sendTemplatedEmail(options: SendOptions): Promise<SendResult> {
  const db = journal();
  const { subject, html } = renderTemplate(options.template, options.values);

  if (options.dedupeKey && db) {
    const { data: existing } = await db
      .from("email_logs")
      .select("id, status")
      .eq("dedupe_key", options.dedupeKey)
      .maybeSingle();
    if (existing) {
      return { ok: true, skipped: "duplicate", message: `Already sent (${existing.status}).` };
    }
  }

  let logId: number | undefined;
  if (db) {
    const { data: created } = await db
      .from("email_logs")
      .insert({
        recipient: options.to,
        user_id: options.userId ?? null,
        template: options.template,
        subject,
        body: html,
        dedupe_key: options.dedupeKey ?? `${options.template}:${options.to}:${Date.now()}`,
        status: "queued",
        provider: emailConfig.provider,
        borrow_transaction_id: options.transactionId ?? null,
      })
      .select("id")
      .single();
    logId = created?.id;
  }

  if (!emailConfig.enabled) {
    console.info(`[rcc-libro:email] DEV OUTBOX → ${options.to} · ${subject}`);
    if (logId && db) {
      await db
        .from("email_logs")
        .update({ status: "skipped", error: offlineReason() })
        .eq("id", logId);
    }
    return { ok: true, skipped: "not_configured", message: "No transport configured; recorded in outbox log.", logId };
  }

  try {
    const receipt = await deliver({ to: options.to, subject, html });

    if (logId && db) {
      await db
        .from("email_logs")
        .update({ status: "sent", sent_at: new Date().toISOString(), provider_id: receipt.id })
        .eq("id", logId);
    }
    return { ok: true, message: `Sent through ${emailConfig.label}.`, logId };
  } catch (error) {
    const message = providerMessage(error);
    if (logId && db) {
      await db.from("email_logs").update({ status: "failed", error: message }).eq("id", logId);
    }
    return { ok: false, message };
  }
}

/**
 * Flushes rows staged by the `stage_due_reminders()` SQL function.
 *
 * The queue is leased through `claim_email_queue()` (`FOR UPDATE SKIP LOCKED`),
 * so this is safe to run alongside the `due-reminders` Edge Function — a row is
 * handed to exactly one runner per attempt, and a runner that dies mid-flight
 * has its lease returned by `release_stale_email_claims()`.
 */
export async function deliverQueuedEmails(limit = 40) {
  const db = journal();
  if (!db) {
    return { delivered: 0, failed: 0, message: "Service role key missing — queue not processed." };
  }

  await db.rpc("release_stale_email_claims", { p_lease: "15 minutes" });

  const { data: pending, error } = await db.rpc("claim_email_queue", {
    p_limit: Math.max(1, Math.min(limit, 100)),
  });

  if (error) return { delivered: 0, failed: 0, message: error.message };
  if (!pending?.length) return { delivered: 0, failed: 0, message: "Nothing queued." };

  const ready = emailConfig.enabled;
  let delivered = 0;
  let failed = 0;

  for (const row of pending as QueuedEmail[]) {
    if (!ready) {
      console.info(`[rcc-libro:email] DEV OUTBOX → ${row.recipient} · ${row.subject}`);
      await db.rpc("record_email_result", {
        p_id: row.id,
        p_status: "skipped",
        p_error: offlineReason(),
      });
      continue;
    }
    try {
      const receipt = await deliver({
        to: row.recipient,
        subject: row.subject,
        html: row.body ?? "",
      });
      await db.rpc("record_email_result", {
        p_id: row.id,
        p_status: "sent",
        p_provider_id: receipt.id,
      });
      // `stage_due_reminders()` leaves `provider` at its column default, which
      // names the transport SQL assumed rather than the one that delivered it.
      await db.from("email_logs").update({ provider: receipt.provider }).eq("id", row.id);
      delivered += 1;
    } catch (sendError) {
      failed += 1;
      await db.rpc("record_email_result", {
        p_id: row.id,
        p_status: "failed",
        p_error: providerMessage(sendError),
      });
    }
  }

  return { delivered, failed, message: `Processed ${pending.length} queued message(s).` };
}

interface QueuedEmail {
  id: number;
  recipient: string;
  subject: string;
  body: string | null;
}
