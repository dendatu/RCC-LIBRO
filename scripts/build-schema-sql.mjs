// Rebuilds the paste-ready SQL-editor files from supabase/migrations:
//   supabase/schema.sql      — structure only (safe to run on a real project)
//   supabase/seed-demo.sql   — demo accounts and sample catalogue (optional)
//   node scripts/build-schema-sql.mjs
import { readdir, readFile, writeFile } from "node:fs/promises";

const dir = "supabase/migrations";
const files = (await readdir(dir)).filter((name) => name.endsWith(".sql")).sort();

const isSeed = (name) => /seed|demo/i.test(name);
const structure = files.filter((name) => !isSeed(name));
const seeds = files.filter(isSeed);

function header(title, list, note) {
  return `-- ===========================================================================
-- RCC LIBRO — ${title}
-- Republic Central Colleges, Angeles City Campus
--
-- Paste this whole file into the Supabase SQL Editor; it runs as one script in
-- the order listed below.
--
-- Source migrations:
${list.map((name) => `--   ${name}`).join("\n")}
--
${note}
-- ===========================================================================\n\n`;
}

async function render(list) {
  let out = "";
  for (const name of list) {
    const sql = await readFile(`${dir}/${name}`, "utf8");
    out += `\n-- >>>>>>>>>>>>>>>>>>>>>>>>>> ${name} <<<<<<<<<<<<<<<<<<<<<<<<\n\n${sql.trimEnd()}\n\n`;
  }
  return out;
}

const structureNote = `-- Google OAuth: migration 00005 installs an "on insert/update on auth.users" trigger,
-- so every provider (Google, e-mail/password, magic link) provisions public.users,
-- profiles, user_roles and borrower_records automatically on first sign-in.`;

const seedNote = `-- OPTIONAL. Creates demo logins with the shared password documented inside the file.
-- Do NOT run this against a live library database. Remove it before going public.`;

await writeFile(
  "supabase/schema.sql",
  header("Consolidated schema (structure, no demo data)", structure, structureNote) +
    (await render(structure)),
  "utf8",
);

await writeFile(
  "supabase/seed-demo.sql",
  header("Consolidated demo data (optional)", seeds, seedNote) + (await render(seeds)),
  "utf8",
);

console.log(
  `supabase/schema.sql (${structure.length} migrations) + supabase/seed-demo.sql (${seeds.length}) written`,
);
