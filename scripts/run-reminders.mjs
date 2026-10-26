// Runs the due-date sweep through the same endpoint Vercel Cron calls:
// overdue marking, the 7/3/1-day reminders and the SMTP flush.
//
//   node scripts/run-reminders.mjs             once
//   node scripts/run-reminders.mjs --loop      daily at REMINDER_AT (default 22:00 UTC)
//
// Reads REMINDER_URL and CRON_SECRET from the environment first, then
// .env.local, so the containerized stack and a local `npm run dev` share one
// path. Re-running is harmless: stage_due_reminders() dedupes on
// email_logs.dedupe_key, so a second sweep the same day sends nothing new.

import { readFileSync } from "node:fs";

const LOOP = process.argv.includes("--loop");

function fromEnvFile(name) {
  for (const file of [".env.local", ".env"]) {
    let text;
    try {
      text = readFileSync(file, "utf8");
    } catch {
      continue;
    }
    for (const line of text.split(/\r?\n/)) {
      const match = /^([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line.trim());
      if (match?.[1] === name) return match[2].replace(/^["']|["']$/g, "");
    }
  }
  return null;
}

const read = (name) => process.env[name]?.trim() || fromEnvFile(name)?.trim() || "";

const site = read("NEXT_PUBLIC_SITE_URL") || "http://localhost:3000";
const target = read("REMINDER_URL") || `${site.replace(/\/$/, "")}/api/cron/reminders`;
const secret = read("CRON_SECRET");

async function sweep() {
  const stamp = new Date().toISOString();
  try {
    const response = await fetch(target, {
      headers: secret ? { Authorization: `Bearer ${secret}` } : {},
      cache: "no-store",
    });
    const body = await response.json().catch(() => null);
    if (!response.ok) {
      console.error(`[${stamp}] sweep refused (HTTP ${response.status}): ${body?.message ?? target}`);
      return false;
    }
    const staged = body?.staged ?? {};
    console.log(
      `[${stamp}] staged ${staged.staged ?? 0} reminder(s), ` +
        `${staged.overdue_marked ?? 0} marked overdue; ` +
        `delivered ${body?.queue?.delivered ?? 0}, failed ${body?.queue?.failed ?? 0} — ` +
        `${body?.queue?.message ?? "no queue report"}`,
    );
    return Boolean(body?.ok);
  } catch (error) {
    console.error(`[${stamp}] could not reach ${target}: ${error.message}`);
    return false;
  }
}

/** Milliseconds until the next occurrence of "HH:MM", read as UTC. */
function untilNext(hhmm) {
  const [hour, minute] = hhmm.split(":").map((part) => Number.parseInt(part, 10));
  const next = new Date();
  next.setUTCHours(Number.isFinite(hour) ? hour : 22, Number.isFinite(minute) ? minute : 0, 0, 0);
  if (next.getTime() <= Date.now()) next.setUTCDate(next.getUTCDate() + 1);
  return next.getTime() - Date.now();
}

if (!LOOP) {
  const ok = await sweep();
  process.exit(ok ? 0 : 1);
}

const at = read("REMINDER_AT") || "22:00";
console.log(`Reminder sweep runs daily at ${at} UTC (${read("TZ") || "container clock"}). First pass now.`);
await sweep();
for (;;) {
  await new Promise((resolve) => setTimeout(resolve, untilNext(at)));
  await sweep();
}
