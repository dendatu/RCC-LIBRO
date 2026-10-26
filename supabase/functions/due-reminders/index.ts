// RCC LIBRO — due-date reminder worker (Supabase Edge Function)
//
// One invocation does the whole job, and every step is idempotent so a retried
// cron tick cannot double-mail anyone:
//   1. release leases abandoned by a previous run,
//   2. stage the 7/3/1-day notices plus the overdue notice (SQL dedupes on
//      email_logs.dedupe_key),
//   3. claim the queue atomically (FOR UPDATE SKIP LOCKED) and deliver it.
//
// Secrets (supabase secrets set ...):
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, CRON_SECRET,
//   RESEND_API_KEY, RESEND_FROM_ADDRESS, NEXT_PUBLIC_SITE_URL
//
// Deploy:   supabase functions deploy due-reminders --no-verify-jwt
// Invoke:   curl -X POST "$URL/due-reminders" -H "Authorization: Bearer $CRON_SECRET"

import {
  claimQueue,
  loadConfig,
  OutboxError,
  recordResult,
  releaseStaleLeases,
  sendWithResend,
  stageReminders,
} from "../_shared/outbox.ts";

const MAX_LEASE_MINUTES = 15;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: {
      "content-type": "application/json",
      "access-control-allow-origin": "*",
    },
  });
}

/** Length-checked digest compare; the payload is small so timing is not a concern. */
async function bearerOk(request: Request): Promise<boolean> {
  const secret = Deno.env.get("CRON_SECRET") ?? "";
  if (!secret) return false;
  const header = request.headers.get("authorization") ?? "";
  const presented = header.startsWith("Bearer ") ? header.slice(7) : header;
  if (presented.length !== secret.length) return false;

  const encoder = new TextEncoder();
  const [a, b] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(presented)),
    crypto.subtle.digest("SHA-256", encoder.encode(secret)),
  ]);
  const va = new Uint8Array(a);
  const vb = new Uint8Array(b);
  let diff = 0;
  for (let i = 0; i < va.length; i++) diff |= va[i] ^ vb[i];
  return diff === 0;
}

function claimLimit(request: Request): number {
  const raw = Number(new URL(request.url).searchParams.get("limit") ?? "50");
  if (!Number.isFinite(raw)) return 50;
  return Math.max(1, Math.min(100, Math.trunc(raw)));
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "access-control-allow-origin": "*",
        "access-control-allow-methods": "POST, GET, OPTIONS",
        "access-control-allow-headers": "authorization, content-type",
        "access-control-max-age": "600",
      },
    });
  }

  if (!(await bearerOk(request))) {
    return json(
      {
        ok: false,
        message:
          "Missing or mismatched Authorization: Bearer <CRON_SECRET>. Set the secret with `supabase secrets set CRON_SECRET=...`.",
      },
      401,
    );
  }

  let cfg;
  try {
    cfg = loadConfig();
  } catch (error) {
    return json({ ok: false, message: (error as Error).message }, 500);
  }

  const startedAt = Date.now();
  const dryRun = !cfg.apiKey;

  try {
    const requeued = await releaseStaleLeases(cfg, MAX_LEASE_MINUTES);
    const staged = await stageReminders(cfg);
    const claimed = await claimQueue(cfg, claimLimit(request));

    let delivered = 0;
    let failed = 0;
    let skipped = 0;
    const errors: Array<{ id: number; dedupe_key: string; error: string }> = [];

    // Sequential on purpose: Resend's free tier is rate limited, and a queue
    // this size does not need concurrency.
    for (const row of claimed) {
      if (dryRun) {
        await recordResult(cfg, row.id, "skipped", {
          error: "RESEND_API_KEY not configured for this function",
        });
        skipped += 1;
        continue;
      }

      const outcome = await sendWithResend(cfg, row);
      if (outcome.ok) {
        await recordResult(cfg, row.id, "sent", { providerId: outcome.providerId ?? null });
        delivered += 1;
      } else {
        const message = outcome.error ?? "unknown provider error";
        // 4xx from Resend means the request itself is unacceptable (bad domain,
        // bounced recipient); 5xx/429 stays retryable through the lease.
        const terminal = /resend 4(00|04|22)\b/.test(message);
        await recordResult(cfg, row.id, terminal ? "failed" : "skipped", { error: message });
        if (terminal) failed += 1;
        else skipped += 1;
        errors.push({ id: row.id, dedupe_key: row.dedupe_key, error: message });
      }
    }

    return json({
      ok: true,
      dryRun,
      staged,
      requeued,
      claimed: claimed.length,
      delivered,
      failed,
      skipped,
      ranAt: new Date().toISOString(),
      tookMs: Date.now() - startedAt,
      errors: errors.slice(0, 5),
    });
  } catch (error) {
    const message = error instanceof OutboxError
      ? error.message
      : (error as Error)?.message ?? "unexpected failure";
    return json({ ok: false, message, ranAt: new Date().toISOString() }, 500);
  }
});
