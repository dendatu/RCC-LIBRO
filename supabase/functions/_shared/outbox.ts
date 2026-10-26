// Shared helpers for the RCC LIBRO outbound e-mail Edge Functions.
//
// Deno runtime, no third-party imports: the queue is reached through PostgREST
// with the service-role key (email_logs is admin-only under RLS) and the send
// goes straight to the Resend REST API.

export interface EmailRow {
  id: number;
  recipient: string;
  user_id: string | null;
  template: string;
  subject: string;
  body: string | null;
  dedupe_key: string;
  status: string;
  attempts: number;
}

export interface OutboxConfig {
  url: string;
  serviceKey: string;
  apiKey: string | null;
  fromAddress: string;
  fromName: string;
  siteUrl: string;
}

export class OutboxError extends Error {}

export function loadConfig(): OutboxConfig {
  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey =
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SERVICE_ROLE_KEY") ?? "";
  if (!url || !serviceKey) {
    throw new OutboxError(
      "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set as function secrets.",
    );
  }
  return {
    url: url.replace(/\/+$/, ""),
    serviceKey,
    apiKey: Deno.env.get("RESEND_API_KEY") || null,
    fromAddress: Deno.env.get("RESEND_FROM_ADDRESS") || "library@rcc.edu.ph",
    fromName: Deno.env.get("RESEND_FROM_NAME") || "RCC LIBRO",
    siteUrl: (Deno.env.get("NEXT_PUBLIC_SITE_URL") ?? Deno.env.get("SITE_URL") ?? "")
      .replace(/\/+$/, ""),
  };
}

async function postgrest<T>(
  cfg: OutboxConfig,
  path: string,
  init: RequestInit,
): Promise<T> {
  const response = await fetch(`${cfg.url}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: cfg.serviceKey,
      Authorization: `Bearer ${cfg.serviceKey}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new OutboxError(`PostgREST ${response.status} on ${path}: ${detail.slice(0, 300)}`);
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

/** Stage the 7/3/1-day and overdue notices for every eligible loan. */
export async function stageReminders(cfg: OutboxConfig): Promise<{
  staged: number;
  overdue_marked: number;
}> {
  const data = await postgrest<{ staged: number; overdue_marked: number }>(
    cfg,
    "rpc/stage_due_reminders",
    { method: "POST", body: "{}" },
  );
  return data ?? { staged: 0, overdue_marked: 0 };
}

/** Free leases left behind by a runner that died mid-flight. */
export async function releaseStaleLeases(cfg: OutboxConfig, minutes = 15): Promise<number> {
  const count = await postgrest<number>(cfg, "rpc/release_stale_email_claims", {
    method: "POST",
    body: JSON.stringify({ p_lease: `${minutes} minutes` }),
  });
  return typeof count === "number" ? count : 0;
}

/** Atomically lease the oldest queued messages to this runner only. */
export async function claimQueue(cfg: OutboxConfig, limit: number): Promise<EmailRow[]> {
  const rows = await postgrest<EmailRow[]>(cfg, "rpc/claim_email_queue", {
    method: "POST",
    body: JSON.stringify({ p_limit: limit }),
  });
  return rows ?? [];
}

/** Write the terminal state for a claimed row. */
export async function recordResult(
  cfg: OutboxConfig,
  id: number,
  status: "sent" | "failed" | "skipped" | "bounced",
  extras: { providerId?: string | null; error?: string | null } = {},
): Promise<void> {
  await postgrest<void>(cfg, "rpc/record_email_result", {
    method: "POST",
    body: JSON.stringify({
      p_id: id,
      p_status: status,
      p_provider_id: extras.providerId ?? null,
      p_error: extras.error ?? null,
    }),
  });
}

export interface SendOutcome {
  ok: boolean;
  providerId?: string;
  error?: string;
}

export async function sendWithResend(cfg: OutboxConfig, row: EmailRow): Promise<SendOutcome> {
  if (!cfg.apiKey) return { ok: false, error: "RESEND_API_KEY is not configured" };

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${cfg.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: `${cfg.fromName} <${cfg.fromAddress}>`,
      to: row.recipient,
      subject: row.subject,
      html: renderEmailHtml(cfg, row),
      headers: { "X-Entity-Ref-ID": row.dedupe_key },
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    return { ok: false, error: `resend ${response.status}: ${detail.slice(0, 300)}` };
  }
  const data = (await response.json().catch(() => null)) as { id?: string } | null;
  return { ok: true, providerId: data?.id };
}

const TEMPLATES: Record<string, { greeting: string; note: string; cta: string; href: string }> = {
  due_reminder: {
    greeting: "A book you borrowed is due back soon.",
    note: "Renew it online if it is still in use, or bring it to the circulation desk before the due date to avoid a fine.",
    cta: "View my borrowings",
    href: "/dashboard/borrowings",
  },
  overdue_notice: {
    greeting: "A borrowed book is now overdue.",
    note: "Fines accrue every calendar day, weekends and holidays included, until the copy is checked in.",
    cta: "View overdue items",
    href: "/dashboard/borrowings",
  },
  reservation_ready: {
    greeting: "A reserved title is waiting for you on the hold shelf.",
    note: "Pick it up at the circulation desk; the hold is released if it goes unclaimed.",
    cta: "View my holds",
    href: "/dashboard/reservations",
  },
  fine_assessed: {
    greeting: "A fine has been posted to your library account.",
    note: "Settle it at the circulation desk. Unresolved penalties block further borrowing.",
    cta: "View my penalties",
    href: "/dashboard/penalties",
  },
  fine_settled: {
    greeting: "Your fine has been settled.",
    note: "Thank you. Your borrowing privileges are unchanged.",
    cta: "Open my account",
    href: "/dashboard/profile",
  },
};

/** Branded wrapper around the plain text body staged by the SQL job. */
export function renderEmailHtml(cfg: OutboxConfig, row: EmailRow): string {
  const t = TEMPLATES[row.template] ?? {
    greeting: "A message from the RCC LIBRO circulation desk.",
    note: "",
    cta: "Open RCC LIBRO",
    href: "/dashboard",
  };
  const link = cfg.siteUrl ? `${cfg.siteUrl}${t.href}` : "";
  const escaped = (row.body ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const cta = link
    ? `<p style="margin:26px 0 0"><a href="${link}" style="background:#6F4E37;color:#fff;text-decoration:none;padding:11px 20px;border-radius:10px;font-weight:600">${t.cta}</a></p>`
    : "";

  return `<!doctype html><html><body style="margin:0;background:#F5F0E6;padding:26px 12px;font-family:Georgia,'Times New Roman',serif;color:#2D2D2D">
<table role="presentation" width="100%" style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #E7DDCB;border-radius:16px;overflow:hidden">
  <tr><td style="background:#6F4E37;padding:18px 24px">
    <span style="color:#F5F0E6;font-size:17px;letter-spacing:.06em;text-transform:uppercase">RCC LIBRO</span><br>
    <span style="color:#D4A373;font-size:12px">Republic Central Colleges &mdash; Angeles City Campus Library</span>
  </td></tr>
  <tr><td style="padding:26px 24px 8px">
    <h1 style="margin:0 0 10px;font-size:19px;line-height:1.35">${t.greeting}</h1>
    <p style="margin:0 0 14px;font-size:15px;line-height:1.65;white-space:pre-line">${escaped}</p>
    ${t.note ? `<p style="margin:0;color:#6b6257;font-size:13px;line-height:1.6">${t.note}</p>` : ""}
    ${cta}
  </td></tr>
  <tr><td style="padding:16px 24px;border-top:1px solid #EFE8DA;color:#8a8177;font-size:12px">
    Automated notice from the library circulation system &mdash; please do not reply to this message.
  </td></tr>
</table></body></html>`;
}
