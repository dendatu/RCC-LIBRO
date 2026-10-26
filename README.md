# RCC LIBRO

**Library Inventory and Book Recording Organizer** — a library management and
borrowing system for **Republic Central Colleges, Angeles City Campus**.

Librarians catalogue books across three branches, issue and check in loans by QR
barcode, and collect fines; students and faculty log in with Google or e-mail to
see their loans, due dates, digital SBTR and library card; administrators set the
policy, watch analytics and read the audit trail.

- Stack: **Next.js 15 App Router**, TypeScript, Tailwind CSS v4, shadcn-style
  components, Framer Motion, Recharts, React Hook Form + Zod
- Backend: **Supabase** (Postgres, Auth with Google SSO, Row Level Security),
  business rules implemented as Postgres functions
- E-mail: **Resend**, journaled in `email_logs` with idempotent deduplication
- Brand: brown `#6F4E37`, cream `#F5F0E6`, gold `#D4A373`

---

## 1. Prerequisites

| Tool    | Why                                        | Verified with                 |
| ------- | ------------------------------------------ | ----------------------------- |
| Node 20+ | Build and run the app                      | `node -v` (developed on 24.x) |
| Docker  | Optional — local SQL validation only       | `docker info`                 |
| Supabase project | Database, auth, RLS               | —                             |
| SMTP relay (optional)          | Outbound e-mail: Gmail's app-password SMTP works, as does Resend | — |

Without Docker the schema still deploys normally through the Supabase dashboard;
Docker is only used by `npm run validate:sql` (section 6).

---

## 2. Install

```bash
npm install
```

Copy the environment template and fill in the values from your Supabase project
(Settings → API):

```bash
cp .env.example .env.local
```

> If `.env.local` already exists in this checkout it holds **placeholder** values
> written during build verification — the app cannot reach Supabase with them.
> Replace the whole file with your real keys. Blank `RESEND_API_KEY` and
> `CRON_SECRET` are fine: an empty value is treated as "unset" rather than a
> validation failure.

| Variable                       | Required | Where it comes from |
| ------------------------------ | -------- | ------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`     | yes      | Supabase → Project Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`| yes      | same page → `anon` / `publishable` key |
| `SUPABASE_SERVICE_ROLE_KEY`    | yes      | same page → `service_role` / `secret` key — **server only** |
| `NEXT_PUBLIC_SITE_URL`         | prod     | your deployed origin (used for QR payloads + auth redirects) |
| `MAIL_SMTP_HOST` / `_PORT` / `_USER` / `_PASS` | no | an SMTP relay — Gmail works, see §7. Without any transport e-mail is journaled as `skipped` and never sent |
| `MAIL_FROM`                    | no       | mailbox the notices come from; the display name is always `RCC LIBRO` |
| `RESEND_API_KEY`               | no       | resend.com → API Keys, the alternative transport |
| `CRON_SECRET`                  | prod     | any long random string; guards `/api/cron/reminders` |

> `SUPABASE_SERVICE_ROLE_KEY` deliberately has **no** `NEXT_PUBLIC_` prefix. It
> bypasses Row Level Security and must never reach the browser. The only module
> that imports it, [`src/lib/supabase/admin.ts`](file:///C:/Users/user/Documents/RCC%20LIBRO/src/lib/supabase/admin.ts),
> starts with `import "server-only"`, so a client-side import fails the build.

The app boots without any of these variables (pages show a configuration notice
instead of crashing), which is useful for a first UI review:

```bash
npm run dev
```

---

## 3. Create the Supabase project and apply the schema

1. Supabase Dashboard → **New project** → name it `rcc-libro`, choose a strong
   database password and the region nearest the campus.
2. Wait until the project shows `Healthy`.
3. **SQL Editor** → *New query*. The fastest path is the three paste-ready files,
   applied in this order — each one is a single script, so paste the whole file
   and press *Run*:

   ```
   supabase/schema.sql          structure only: tables, enums, indexes, FKs,
                                triggers, functions, views, RLS   (no demo data)
   npm run demo:accounts        OPTIONAL, only for the demo data below: creates the
                                seven sign-in logins through GoTrue's admin API
   supabase/seed-demo.sql       OPTIONAL demo roles + sample catalogue
                                (skip both on a real deployment; safe to re-paste,
                                run supabase/cleanup-demo.sql first to start over)
   supabase/check-and-admin.sql read-only install check, then grants `admin`
                                to the account you signed in with
   ```

   `seed-demo.sql` deliberately refuses to create credentials: GoTrue owns
   `auth.users`, and a row written into it with plain SQL cannot be read back by
   the sign-in path, so the logins have to come from `npm run demo:accounts`, from
   **Dashboard → Authentication → Users**, or from a real sign-up. Its preflight
   names any account that is still missing and stops before writing anything.
   Regenerate the first two from the numbered migrations with
   `npm run schema:sql`. To review or apply them one dependency at a time, use
   `supabase/migrations/00001…00011` in numeric order — `00009_seed_demo.sql` is
   the same content as `seed-demo.sql`.

   Or, with the Supabase CLI installed:

   ```bash
   supabase link --project-ref <your-project-ref>
   supabase db push
   ```

What the schema creates: 18 tables, 16 enums, the three RCC branches
(Elementary, High School, College & Graduate School), the seeded policy settings,
the catalogue full-text index, digital book cards, triggers that keep copy/book/
borrower counters consistent, the RPC functions that hold every borrowing rule,
Row Level Security on every table, and the `handle_new_user()` trigger that turns
a fresh Google or e-mail signup into a `users` + `profiles` +
`borrower_records` set automatically.

---

## 4. Authentication setup

### E-mail and password

Supabase → **Authentication → Providers → Email** is enabled by default. For
local development, turn *Confirm email* off (Authentication → Sign In / Up) so
signups work without a mail server; turn it back on before going live and
configure your SMTP under **Authentication → Email → SMTP settings**.

### Google sign-in

1. Google Cloud Console → *Create/Organisation project* → **APIs & Services →
   OAuth consent screen** → External, fill in the app name and your domain.
2. **Credentials → Create credentials → OAuth client ID → Web application**.
   - Authorised JavaScript origins: `http://localhost:3000` and your production
     origin.
   - Authorised redirect URIs:
     `https://<your-project-ref>.supabase.co/auth/v1/callback`
3. Copy the client id and secret into Supabase → **Authentication → Providers →
   Google** and enable it.
4. Supabase → **Authentication → URL Configuration**:
   - Site URL: `http://localhost:3000` while developing, your real domain in
     production.
   - Additional redirect URLs: `http://localhost:3000/auth/callback` and
     `https://your-domain/auth/callback`.
5. In the app, **Sign in with Google** calls
   [`signInWithGoogle`](file:///C:/Users/user/Documents/RCC%20LIBRO/src/server/actions/auth.ts)
   and Supabase redirects back to
   [`src/app/auth/callback/route.ts`](file:///C:/Users/user/Documents/RCC%20LIBRO/src/app/auth/callback/route.ts),
   which exchanges the PKCE code for a session. Every member — borrower,
   librarian, administrator — can use Google; roles are assigned inside the app,
   never by the identity provider.

### Password reset

`/forgot-password` sends the recovery mail and `/reset-password` completes it; the
redirect template must point at `<site-url>/reset-password`.

---

## 5. Demo accounts

Seven accounts, so the whole system is reviewable on day one. **Password for all
of them: `RccLibrary#2026`** (override with `DEMO_PASSWORD` when running
`npm run demo:accounts`).

| E-mail                   | Role      | Profile                                   |
| ------------------------ | --------- | ----------------------------------------- |
| `admin@rcc.edu.ph`       | Admin     | System administrator                      |
| `librarian@rcc.edu.ph`   | Librarian | Head librarian                            |
| `circ@rcc.edu.ph`        | Librarian | Circulation desk                          |
| `student@rcc.edu.ph`     | Borrower  | College student, holds two open loans     |
| `grade6@rcc.edu.ph`      | Borrower  | Elementary, Grade 6                       |
| `shs@rcc.edu.ph`         | Borrower  | Senior High (SSH track), one overdue loan |
| `grad@rcc.edu.ph`        | Borrower  | Graduate School                           |

It also seeds 20 titles across all branches and sections, 46 physical copies with
barcodes and digital book cards, 30 historical loans, a fine, a reservation and
notifications.

An account you created yourself keeps **your** password — the seed only fills in the
role, SBTR and card fields for an email that already exists. If a demo login answers
*"That e-mail and password do not match our records"* or *"Database error querying
schema"*, the `auth.users` row was written by plain SQL somewhere along the way, and
GoTrue cannot read it back. Recover with the three steps in order: paste
`supabase/cleanup-demo.sql`, run `npm run demo:accounts`, then paste
`supabase/seed-demo.sql` again — the sample catalogue and history are rebuilt by the
seed, and only the demo accounts' ids change.

> **Before going live:** delete or rotate these accounts and remove
> `00009_seed_demo.sql` from your pipeline. The demo `auth.users` rows carry a
> bcrypt hash of a known password.

---

## 6. Validating the schema locally (optional but recommended)

```bash
npm run validate:sql
```

This starts a throwaway `postgres:16-alpine` container, applies
`supabase/local/auth_shim.sql` (a stand-in for Supabase's managed `auth` schema
and the `anon` / `authenticated` / `service_role` roles), runs all eleven
migrations, then executes `supabase/local/verify.sql`, which asserts:

- the seeded object and row-model counts;
- the due-date rules (general 7 days, reserve 1 hour before 16:00 and next-day
  23:59 after it, reference due at the desk);
- the fine calculator (₱1/day rounded up, including weekends; ₱2/hour for
  reserve stock);
- that in-house stock cannot be borrowed and every copy carries a QR book card;
- a full circulation scenario as a signed-in librarian — SBTR gate, an issued
  loan, counter refresh, backdating to overdue, check-in with the fine assessed,
  the loan-limit ceiling and a reservation;
- that reminder staging is idempotent (second run stages 0 e-mails);
- that the outbound queue lease is single-owner: a claimed row is `sending`,
  cannot be claimed twice, records `sent_at` only on success, and an abandoned
  lease is requeued — or failed for good once it hits the attempt cap;
- that neither `anon` nor a signed-in member holds `execute` on the queue
  functions, and a caller carrying a subject claim is refused even if a broad
  grant is restored later;
- that cross-member analytics RPCs respect the caller: `borrower_summary()`
  answers a member with their own counts, and `most_active_borrowers()` is empty
  unless the caller is staff;
- that a borrower can only ever see their own rows under RLS.

Add `--keep` to leave the container up for manual poking:
`docker exec -it rcc-libro-schema-check psql -U postgres -d rcc_libro`.
Add `--paste` to install the consolidated SQL-editor files instead of the
numbered migrations — the same path a human follows in the Supabase dashboard.
`supabase/local/` is a test harness and is **never** applied to a hosted project.

---

## 7. E-mail reminders and the delivery job

Every notice leaves with the display name **RCC LIBRO**. Four things are sent:
the borrow confirmation (issued straight from the desk action, so the borrower
has the due date in writing before they walk away), the due-date reminders
(7, 3 and 1 days before), the overdue notice, and the welcome message.

Due-date reminders and overdue notices are produced by a Postgres function, not
by the UI, so they cannot be skipped or double-sent:

- `stage_due_reminders()` writes one `email_logs` row per notice, keyed by a
  unique `dedupe_key` such as `reminder:7:<transaction-id>`; a second run in the
  same window inserts nothing.
- Each message carries the student name, book title, accession number, due date
  and the fine accruing (`calculate_fine()`).
- In-app notifications are written at the same time, so the borrower sees the
  reminder in `/dashboard/notifications` even when SMTP is not configured.
- Delivery is tracked in `public.email_logs`: `queued → sending →`
  `sent | bounced | failed | skipped`, with `provider_id`, `error`, `attempts`,
  `queued_at` and `sent_at`. The admin console reads this table as the outbox.
- `claim_email_queue()` leases rows with `FOR UPDATE SKIP LOCKED`, so a
  scheduled run and a manual run can never mail the same notice twice, and
  `release_stale_email_claims()` returns leases from a runner that died.
- Those three plus `stage_due_reminders()` are service-role only: revoked by
  name from `public, anon, authenticated` (Supabase grants every new function to
  both API roles otherwise) and guarded by `assert_service_runner()`, which
  refuses any caller carrying a JWT subject.

### Transports

[`src/server/email/provider.ts`](file:///C:/Users/user/Documents/RCC%20LIBRO/src/server/email/provider.ts)
is the only place that talks to a mail service. It picks one:

| `MAIL_PROVIDER` | Needs | Notes |
| --- | --- | --- |
| `smtp` | `MAIL_SMTP_HOST`, `MAIL_SMTP_USER`, `MAIL_SMTP_PASS` | Port 465 is implicit TLS; 587/2525 use STARTTLS unless `MAIL_SMTP_SECURE=false`. |
| `resend` | `RESEND_API_KEY` | Kept for a deployment that verifies its own domain. |
| `console` | — | Nothing is sent; each row is journalled as `skipped` with the reason. |

Leaving `MAIL_PROVIDER` unset picks SMTP when it is configured, otherwise Resend,
otherwise the console. A 7-day loan means the "7 days before" reminder lands the
same day the book is issued, so expect the confirmation and one reminder
together on day zero.

Gmail setup — the account needs 2-Step Verification, then an
**App password** (Google account → Security → App passwords → create one named
for the library):

```dotenv
MAIL_PROVIDER=smtp
MAIL_SMTP_HOST=smtp.gmail.com
MAIL_SMTP_PORT=465
MAIL_SMTP_USER=you@gmail.com
MAIL_SMTP_PASS=xxxx xxxx xxxx xxxx
MAIL_FROM="RCC LIBRO <you@gmail.com>"
```

Gmail refuses a `From` that is not the authenticated mailbox, so `MAIL_FROM` must
use the same address as `MAIL_SMTP_USER`; the app rewrites it to match rather
than failing every send. The app password is a credential: keep it in
`.env.local` / `docker/.env`, both gitignored, and revoke it at
myaccount.google.com/apppasswords if it ever reaches a screenshot or a commit.

### Option A — Supabase Edge Function (Resend only)

Source lives in [`supabase/functions/due-reminders/index.ts`](file:///C:/Users/user/Documents/RCC%20LIBRO/supabase/functions/due-reminders/index.ts)
with shared queue + Resend helpers in `supabase/functions/_shared/outbox.ts`.
It uses the Deno runtime with no third-party imports — which means it **cannot**
use the SMTP transport. Choose this option only if you are sending through
Resend; on Gmail, use Option B or C instead.

```bash
supabase functions deploy due-reminders --no-verify-jwt
supabase secrets set \
  SUPABASE_SERVICE_ROLE_KEY=eyJ... \
  CRON_SECRET="$(openssl rand -hex 32)" \
  RESEND_API_KEY=re_... \
  RESEND_FROM_ADDRESS=library@your-domain.ph \
  NEXT_PUBLIC_SITE_URL=https://your-domain.ph

# run it now
curl -X POST "$SUPABASE_URL/functions/v1/due-reminders" \
  -H "Authorization: Bearer $CRON_SECRET" -H "content-type: application/json"
```

The response reports `staged`, `requeued`, `claimed`, `delivered`, `failed`,
`skipped` and `dryRun` (true when `RESEND_API_KEY` is absent, in which case rows
are journalled as `skipped` rather than sent). `?limit=25` caps a single run.

Edge Functions have no scheduler of their own, so
[`supabase/edge-cron.sql`](file:///C:/Users/user/Documents/RCC%20LIBRO/supabase/edge-cron.sql)
schedules the call with `pg_cron` + `pg_net` (07:00 Asia/Manila daily), then
prints the schedule, the last run results and the outbox rollup. Edit the URL and
secret at the top of its `do` block first — the file refuses to run otherwise.
The scheduled command stores the bearer token in `cron.job`, so that file also
shows a Vault-based alternative if you would rather not keep it in the database.

### Option B — Next.js route on Vercel

```bash
curl -X POST https://your-domain/api/cron/reminders \
  -H "Authorization: Bearer $CRON_SECRET"
```

`/api/cron/reminders` calls the same staging function and drains the queue
through the same lease, so it is safe with either scheduler — but run **one**
of them, or notices will simply spread across both workers. On Vercel the
schedule is declared in [`vercel.json`](file:///C:/Users/user/Documents/RCC%20LIBRO/vercel.json)
(`0 18 * * *`, 18:00 UTC ≈ 02:00 PHT). For any other host, point your own cron at
the same URL with the bearer token.

Missing `MAIL_SMTP_*` / `RESEND_API_KEY` or the service-role key leaves mail
`queued`/`skipped` and logs the reason instead of failing the run.

### Option C — the `mailer` container (self-hosted Docker stack)

The docker stack has no Vercel to schedule it, so
[`docker/docker-compose.yml`](file:///C:/Users/user/Documents/RCC%20LIBRO/docker/docker-compose.yml)
runs a `mailer` service that calls the same endpoint once a day:

```bash
npm run docker:reminders          # sweep now, from the running container
REMINDER_AT=21:30 npm run docker:up   # change the hour (UTC; 22:00 = 06:00 PHT)
```

Outside Docker the same sweep is one command, against whatever `.env.local`
points at:

```bash
npm run reminders
```

Re-running is harmless: `stage_due_reminders()` dedupes on `email_logs.dedupe_key`,
so a second sweep the same day stages nothing and sends nothing.

---

## 8. QR codes

- One QR per physical copy, encoding `rcc-libro://copy/<barcode>`, plus a
  browser-friendly `${SITE_URL}/book/<barcode>` link.
- Images are rendered on demand by
  [`src/app/api/qr/[barcode]/route.ts`](file:///C:/Users/user/Documents/RCC%20LIBRO/src/app/api/qr/[barcode]/route.ts)
  (PNG, cached, with a download filename), so nothing binary needs to be stored
  in git.
- The QR studio (`/dashboard/qr`) produces printable label sheets for a branch,
  section or selection; printing uses the `@media print` rules in
  [`src/app/globals.css`](file:///C:/Users/user/Documents/RCC%20LIBRO/src/app/globals.css).
- At the desk, scanning a label opens `/dashboard/circulation?scan=borrow&barcode=…`,
  which prefills the issue form.
- Borrower cards encode `${SITE_URL}/member/<card-number>`.

---

## 9. Production deployment (Vercel)

1. Push the repository to GitHub and **Import Project** in Vercel; the framework
   preset (Next.js) and default build settings are correct.
2. Project → Settings → Environment Variables: add all six variables from
   section 2. `NEXT_PUBLIC_SITE_URL` must be the final https origin.
3. Deploy, then update Supabase → Authentication → URL Configuration with the
   production Site URL and `/auth/callback` redirect.
4. Add `CRON_SECRET` (the `vercel.json` cron ships with the deployment) and call
   the reminder endpoint once from your terminal to confirm it returns
   `{ "staged": … }`.
5. Send yourself a test reminder and confirm the `email_logs` row flips from
   `queued` to `sent`.
6. Rotate or delete the demo accounts.

Other hosts work the same way: `npm run build && npm start`, with a scheduled
request to `/api/cron/reminders`.

---

## 10. Project layout

```
supabase/
  migrations/        00001-00012, applied in order
  schema.sql         structure only, one paste for the SQL editor
  seed-demo.sql      demo roles + catalogue, optional and re-runnable (needs the
                     logins to exist first: npm run demo:accounts)
  cleanup-demo.sql   removes the sample data again, in foreign-key order
  check-and-admin.sql install check and the OAuth admin grant
  edge-cron.sql      pg_cron + pg_net scheduler entry for the reminder job
  functions/         Edge Function source (due-reminders, _shared)
  local/             auth shim + assertion harness (never deployed)
src/
  app/
    (public)/        landing, /policies, /about, /opac catalogue search
    (auth)/          login, register, forgot/reset password
    dashboard/       the signed-in application, split by role
    api/             /api/qr/[barcode], /api/cron/reminders
    auth/            callback + email confirmation routes
  components/
    ui/              design system (shadcn-style, Radix primitives)
    shell/           sidebar, top bar, page header
    marketing/ auth/ catalog/ circulation/ reservations/ analytics/ admin/
  server/
    actions/         Server Actions: auth, catalog, circulation, reservations, admin
    email/           Resend client + HTML templates
  lib/
    supabase/        browser / session / service-role clients + middleware
    rbac.ts          session resolution and role guards
    validators.ts    one Zod schema per form
    types.ts         row types mirroring the SQL tables
    constants.ts     sections, classifications, policy figures, labels
    qr.ts pdf.ts csv.ts nav.ts env.ts
docs/ARCHITECTURE.md how the layers fit together
scripts/             image placeholders, schema concat, SQL validation, demo logins
Dockerfile           multi-stage production image (output: "standalone")
docker/              self-hosted stack: compose, Kong routes, initdb helpers
```

The route map, labels and role visibility for every page live in
[`src/lib/nav.ts`](file:///C:/Users/user/Documents/RCC%20LIBRO/src/lib/nav.ts)
— that file is the single source of truth for navigation, and each page repeats
the guard so a hand-typed URL cannot escalate.

---

## 11. Feature and policy reference

Borrowing rules encoded in the database (editable by an administrator under
**Policy settings**, enforced by `borrow_book()` whatever the UI does):

| Rule                                   | Default                |
| -------------------------------------- | ---------------------- |
| Books per student                      | 3                      |
| Loan period                            | 7 days, due 23:59      |
| Late fine                              | ₱1 per day, weekends and holidays included |
| Reserve collection                     | 1 hour in-library; take-home from 16:00, due next school day, ₱2 per hour overdue |
| Reference and periodicals              | library use only       |
| SBTR                                   | required before a student may borrow |
| Account blocked                        | any overdue loan, or unpaid fines ≥ ₱100 |
| Lost book                              | replacement price + ₱150 processing |
| Damaged book                           | 50 % of the acquisition price |
| Reminders                              | 7, 3 and 1 days before the due date, then overdue notice |

Sections: General, Filipiniana, Home Reading, Fiction, Newly Acquired, Reserve,
Research Output, Reference, Periodicals. Classifications run from Kinder to
Grade 12 (with the SHS tracks PBA, SSH, PEAT, PHS), the four college years
(1st–4th Year, each paired with a programme — ABEL, BSA, BSCE, BSIT, BSBA,
BSHM, BSTM, BEED, BSED English/Mathematics/Filipino) and the Graduate School,
plus faculty departments.

Full design notes: [`docs/ARCHITECTURE.md`](file:///C:/Users/user/Documents/RCC%20LIBRO/docs/ARCHITECTURE.md),
and [`supabase/README.md`](file:///C:/Users/user/Documents/RCC%20LIBRO/supabase/README.md)
for the data model.

---

## 12. Scripts

| Command                  | What it does |
| ------------------------ | ------------ |
| `npm run dev`            | local development server |
| `npm run build`          | production build (also type-checks) |
| `npm start`              | serve the built app |
| `npm run lint`           | ESLint over the project |
| `npm run schema:sql`     | rebuild `supabase/schema.sql` + `supabase/seed-demo.sql` from the migrations |
| `npm run demo:accounts`  | create the seven demo logins through GoTrue's admin API (before `seed-demo.sql`) |
| `npm run validate:sql`   | apply every migration to Docker Postgres and run the assertions |
| `npm run validate:sql -- --paste` | same assertions, but pasting the consolidated SQL-editor files instead |
| `npm run seed:images`    | regenerate the placeholder artwork in `public/images/library` |

Drop your own photographs into `public/images/library/` using the same file names
(`hero-01.svg`, `reading-room.svg`, `circulation-desk.svg`,
`branch-elementary.svg`, `branch-highschool.svg`, `branch-college.svg`,
`og-cover.svg`) — the UI references that folder throughout, so real photos become
live without code changes once they are added (upload `.jpg`/`.png` versions and
update the corresponding reference if you replace the format).

---

## 13. Running the whole system on another machine (Docker)

Sections 2-5 put Postgres and Auth in Supabase's cloud, so that installation
needs an internet connection. `docker/` ships the same stack on one machine
instead: Postgres with Supabase's managed roles and `auth` schema, GoTrue for
logins, PostgREST for the data API, Kong as the single origin they are published
from, and the built Next.js app. After the images are downloaded once, the
library runs with the network cable unplugged.

Realtime, Storage and Studio from the official Supabase bundle are left out —
this project opens no realtime channel and stores no uploaded files.

**Prerequisites:** Docker Desktop (WSL2 backend on Windows) or any Docker with
Compose v2. That is all — Node lives inside the image. Plan on one connected run:
roughly 2 GB of base images, then `npm ci` and the Google font files.

```bash
cd "RCC LIBRO/docker"
cp env.example .env            # local credentials, safe to leave as-is
docker compose up -d --build   # or `npm run docker:up` from the project root
```

`up -d --build` gives an empty library: sign up from `/register` and promote the
first account with `supabase/promote-to-admin.sql`. For the demo data — the
catalogue, the sample loans and the seven logins — run the `demo` profile next:

```bash
npm run docker:demo            # = demo-accounts, then seed, in that order
```

The order matters and the compose file enforces it: `00009` can only classify
accounts GoTrue already owns, so the logins are created through the admin API
before `seed-demo.sql` runs. Re-running either is harmless — existing accounts
keep their own passwords and the seed is written to be idempotent.

Then open **http://localhost:3000** and sign in with any account from
[`supabase/seed-demo.sql`](file:///C:/Users/user/Documents/RCC%20LIBRO/supabase/seed-demo.sql)
using `DEMO_PASSWORD` from `docker/.env` (`RccLibrary#2026` by default).

| Command | What it does |
| ------- | ------------ |
| `npm run docker:up` | build and start everything (restarts the app after a code change) |
| `npm run docker:demo` | create the demo logins, then the demo catalogue and loans |
| `npm run docker:logs` | tail the last lines of every container |
| `npm run docker:down` | stop, keeping the database volume |
| `npm run docker:reset` | stop **and delete the database**, so initdb re-applies `schema.sql` |

`docker compose down -v` is the only way to re-run the schema: `supabase/schema.sql`
is applied by Postgres' first-boot `initdb`, exactly like the hosted project's
migration history, and never re-applied on an existing volume. Later migrations
belong in that file — run `npm run schema:sql` first, then `docker:reset`.

No Postgres port is published; reach the database through the container when you
want to inspect it, the same way the SQL editor would be used:

```bash
docker compose -f docker/docker-compose.yml --env-file docker/.env \
  exec db psql -U supabase_admin -d postgres
```

**Ports.** Kong publishes `8000` and the app `3000`, both on `127.0.0.1` only.
The gateway serves `/rest/v1/*` (PostgREST) and `/auth/v1/*` (GoTrue), which is
why the app's `NEXT_PUBLIC_SUPABASE_URL` is `http://localhost:8000`. Those
`NEXT_PUBLIC_*` values are inlined while the image builds, so changing a port
means rebuilding: edit `KONG_HTTP_PORT` in `docker/.env` and re-run `docker:up`
with `--build`. The server side does not need a rebuild — it reads
`SUPABASE_INTERNAL_URL=http://kong:8000`, the in-network address, while the
browser keeps the loopback one.

**What stays offline.** Everything except these four, each off by default:

- *Google SSO* — set `GOOGLE_ENABLED=true`, `GOOGLE_CLIENT_ID` and
  `GOOGLE_CLIENT_SECRET` in `docker/.env`, restart `gotrue`, and allow
  `http://localhost:8000/auth/v1/callback` as the client's redirect URI.
  E-mail/password sign-in and registration always work.
- *Password reset* — GoTrue sends that one mail over SMTP. Point `SMTP_HOST` /
  `SMTP_PORT` at anything listening locally (Mailpit on `1025`) or leave the
  recovery flow unused.
- *Reminder e-mails* — with `RESEND_API_KEY` empty, notices are journalled to
  `email_logs` and printed to the app container's log instead of being sent;
  Resend itself requires internet. Trigger a run with
  `curl -X POST http://localhost:3000/api/cron/reminders -H "Authorization: Bearer $CRON_SECRET"`.
- *QR codes* — they encode `NEXT_PUBLIC_SITE_URL`, so a printed card only scans
  on the machine that served it. For a phone on the same Wi-Fi, bind the ports
  without the `127.0.0.1:` prefix and set `SITE_URL` to this machine's LAN
  address, then rebuild.

**Treating it as production.** `docker/env.example` deliberately ships a JWT
secret and the two API keys signed by it, because the stack binds to loopback
and the alternative is a broken first run. Before any of this leaves the laptop,
replace `SUPABASE_JWT_SECRET` and both keys, set `POSTGRES_PASSWORD`,
rotate `DEMO_PASSWORD`, drop the demo profile, and delete
`supabase/seed-demo.sql` from the install.

