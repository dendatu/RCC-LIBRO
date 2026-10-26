import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { deliverQueuedEmails } from "@/server/email";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

/**
 * Scheduled reminder job. Vercel Cron calls this daily; it
 *   1. marks loans overdue,
 *   2. stages 7/3/1-day and overdue notices (SQL dedupes on `email_logs.dedupe_key`),
 *   3. flushes the queue through the configured provider.
 *
 * Protected by `CRON_SECRET` (Vercel sends it as `Authorization: Bearer …`).
 * Without a secret configured the endpoint only answers in development.
 */
function authorized(request: NextRequest) {
  if (!env.CRON_SECRET) return process.env.NODE_ENV === "development";
  return request.headers.get("authorization") === `Bearer ${env.CRON_SECRET}`;
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  }

  const db = createAdminClient();
  const { data: staged, error } = await db.rpc("stage_due_reminders");
  const queue = await deliverQueuedEmails(60);

  return NextResponse.json({
    ok: !error,
    staged,
    queue,
    ranAt: new Date().toISOString(),
    error: error?.message ?? null,
  });
}
