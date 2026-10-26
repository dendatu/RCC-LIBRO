// Creates the seven demo logins through GoTrue's admin API.
//
//   node scripts/create-demo-accounts.mjs
//
// Only GoTrue can write `auth.users` in a shape it can read back later: a row
// inserted with plain SQL survives in the table but every sign-in attempt against
// it fails, which is why 00009 refuses to create credentials itself. This script
// is the supported way to get them for a local or demo project.
//
// Reads NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from the
// environment first, then .env.local — so `docker compose run demo-accounts`
// can point it at the local gateway without any file in the image.
// Accounts that already exist are left untouched, password included — roles,
// SBTR numbers and the sample catalogue come from supabase/seed-demo.sql.

import { readFileSync } from "node:fs";

const ACCOUNTS = [
  ["admin@rcc.edu.ph", "Atty. Maria Elena Santos"],
  ["librarian@rcc.edu.ph", "Josefina Ramirez"],
  ["circ@rcc.edu.ph", "Marco Dela Cruz"],
  ["student@rcc.edu.ph", "Andrei Reyes"],
  ["grade6@rcc.edu.ph", "Camille Torres"],
  ["shs@rcc.edu.ph", "Nathan Villanueva"],
  ["grad@rcc.edu.ph", "Dr. Liza Mendoza"],
];

const PASSWORD = process.env.DEMO_PASSWORD || "RccLibrary#2026";

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
      if (match?.[1] === name) {
        return match[2].replace(/^["']|["']$/g, "");
      }
    }
  }
  return null;
}

const url = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? fromEnvFile("NEXT_PUBLIC_SUPABASE_URL"))?.trim();
const key = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? fromEnvFile("SUPABASE_SERVICE_ROLE_KEY"))?.trim();

if (!url || !key) {
  console.error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required (.env.local).");
  process.exit(1);
}
if (!/^https?:\/\//.test(url)) {
  console.error(`NEXT_PUBLIC_SUPABASE_URL does not look like a project URL: ${url}`);
  process.exit(1);
}

const headers = { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };

async function listAuthUsers() {
  const all = [];
  for (let page = 1; page <= 20; page++) {
    const response = await fetch(`${url}/auth/v1/admin/users?page=${page}&per_page=200`, { headers });
    if (!response.ok) {
      throw new Error(`listing auth users failed (HTTP ${response.status}): ${(await response.text()).slice(0, 200)}`);
    }
    const body = await response.json();
    const batch = body.users ?? body.result?.users ?? [];
    all.push(...batch);
    if (batch.length < 200) break;
  }
  return all;
}

async function createAccount(email, fullName) {
  const response = await fetch(`${url}/auth/v1/admin/users`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      email,
      password: PASSWORD,
      email_confirm: true,
      app_metadata: { provider: "email", providers: ["email"] },
      user_metadata: { full_name: fullName },
    }),
  });
  const body = await response.text();
  if (!response.ok) {
    throw new Error(`could not create ${email} (HTTP ${response.status}): ${body.slice(0, 200)}`);
  }
  return JSON.parse(body);
}

const existing = await listAuthUsers();
const created = [];
const skipped = [];

for (const [email, fullName] of ACCOUNTS) {
  if (existing.some((user) => (user.email ?? "").toLowerCase() === email)) {
    skipped.push(email);
    console.log(`kept     ${email} (its own password stays in force)`);
    continue;
  }
  await createAccount(email, fullName);
  created.push(email);
  console.log(`created  ${email}`);
}

// The paginated list embeds an empty `identities` array, so each account has to
// be read back by id before its identity can be checked.
const after = await listAuthUsers();
const unusable = [];

for (const [email] of ACCOUNTS) {
  const user = after.find((candidate) => (candidate.email ?? "").toLowerCase() === email);
  if (!user) {
    unusable.push(email);
    continue;
  }
  const response = await fetch(`${url}/auth/v1/admin/users/${user.id}`, { headers });
  const identities = response.ok ? ((await response.json()).identities ?? []) : [];
  if (!identities.some((identity) => identity.provider === "email")) unusable.push(email);
}

console.log(`\n${created.length} created, ${skipped.length} already present.`);

if (unusable.length) {
  console.error(`GoTrue still cannot read: ${unusable.join(", ")}`);
  process.exit(1);
}

console.log("Every demo login is readable by GoTrue. Next: paste supabase/seed-demo.sql");
console.log("in the SQL editor to set the roles, borrower profiles and sample catalogue.");
