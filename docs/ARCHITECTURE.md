# Architecture

RCC LIBRO is a Next.js 15 App Router application with no separate API tier:
Server Components render reads, Server Actions perform writes, and both talk to
Supabase Postgres through `@supabase/ssr`. The borrowing rules live in the
database, so the UI is a presentation of policy rather than its enforcement.

```
browser ──► Next.js route handlers / Server Components        (reads, RLS-scoped)
        ──► Server Actions                                    (writes, role-guarded)
                │
                ├─► createClient()      session client   ──► Postgres + RLS
                ├─► createAdminClient() service role     ──► e-mail delivery only
                └─► db.rpc(...)         business rules   ──► borrow/return/fine/reserve

supabase auth ── cookie session (refreshed in middleware) ──► getMember() cached per request
cron (vercel.json) ──► /api/cron/reminders ──► stage_due_reminders() ──► email_logs ──► Resend
```

## Layers

| Layer | Location | Responsibility |
| ----- | -------- | -------------- |
| Schema + rules | `supabase/migrations/` | Tables, enums, triggers, RPC functions, RLS |
| Data access | `src/lib/supabase/` | Browser, session and service-role clients; cookie refresh |
| Session + authorisation | `src/lib/rbac.ts` | `getMember()` resolves user/profile/standing/roles once per request; `requireRole()` and `guardRole()` gate pages and actions |
| Domain vocabulary | `src/lib/constants.ts`, `src/lib/types.ts` | Section rules, classifications, labels, row types mirroring SQL |
| Input validation | `src/lib/validators.ts` | One Zod schema per form, shared by the client form and the server action |
| Mutations | `src/server/actions/` | Server Actions: validate → `db.rpc()`/insert → `revalidatePath()` → audit |
| Delivery | `src/server/email/` | Resend client, branded HTML templates, `email_logs` journaling |
| Presentation | `src/app/`, `src/components/` | Route tree, design system, feature components |
| Utilities | `src/lib/qr.ts`, `pdf.ts`, `csv.ts`, `nav.ts`, `env.ts` | QR payloads, exports, navigation, typed env |

## Request lifecycle

1. `src/middleware.ts` refreshes the Supabase session cookies on every matched
   request. Unauthenticated traffic to `/dashboard/**` is redirected to
   `/login?next=…`; signed-in users are kept away from `/login` and `/register`.
2. A dashboard layout calls `requireMember()`, which resolves the session once
   (`cache()`-deduped) and supplies the sidebar with role-filtered navigation from
   `src/lib/nav.ts`.
3. The page body queries with the session client, so Postgres RLS decides what the
   caller may see — the page never re-implements row filtering.
4. A form posts to a Server Action. The action calls `guardRole(...)` (throws
   rather than redirects), validates the `FormData` with the same Zod schema the
   client used, invokes the RPC, revalidates the affected paths and returns
   `{ ok, message, errors }`. Errors land in React Hook Form fields; successes
   raise a toast. Nothing is thrown at the React tree.
5. `next-auth`-free session state means no client-side token store; the QR and
   cron routes are the only "API" surface, and both are server-side.

## Role model

Three roles (`borrower`, `librarian`, `admin`) with rank 10/20/30. Every member
holds at least `borrower`; staff roles are additive and resolved to the highest
rank in `getMember()`. Navigation is derived from roles, and each page repeats the
guard so a hand-typed URL cannot escalate. Cross-role rules worth knowing:

- only librarians may issue a loan on behalf of another member (`borrow_book()`
  rejects `forbidden` otherwise);
- only admins may waive a fine, change a role, edit policy settings or read
  `audit_logs` / `email_logs`;
- borrowers edit only their own profile fields, never their limit, standing or
  role;
- reference and periodicals copies are pinned to in-library use by a trigger, so
  they can never reach an issuable state.

## Why the rules sit in Postgres

The capstone requirement is that policy cannot be bypassed by the interface.
Keeping eligibility, due dates, fines, queue promotion and counter refresh in
`security definer` functions means:

- two librarians at two desks cannot double-issue the same copy (the copy row is
  updated inside the same transaction);
- the SBTR, loan-limit and penalty gates apply to any client, including a crafted
  RPC call;
- reminders are idempotent through the unique `email_logs.dedupe_key`, so a
  retried cron run cannot spam a student;
- the UI can display the reason a refusal happened (`reasons[]` from
  `evaluate_borrow_eligibility()`) without owning the logic.

## Front-end structure

- `src/app/(public)` — marketing pages, `/policies`, `/about`, `/opac`
  (public catalogue search, no session needed).
- `src/app/(auth)` — split-screen login, register, forgot/reset password, with a
  Google OAuth button and a `needs_profile` notice state.
- `src/app/dashboard` — the signed-in application. Borrower surfaces
  (borrowings, SBTR, history, penalties, reservations, card, profile,
  notifications); staff surfaces (circulation desk, returns, members, fines,
  requests, catalogue, inventory, QR studio, reports, analytics); admin surfaces
  (console, users, settings, e-mail centre, audit trail, branches).
- `src/app/auth/{callback,confirm}` — PKCE code exchange and e-mail OTP
  verification.
- `src/components/ui` — a hand-vendored shadcn-style set over Radix primitives
  (`cva` variants, `cn()` from clsx + tailwind-merge). Feature folders
  (`catalog`, `circulation`, `reservations`, `analytics`, `admin`, …) hold
  client leaves that receive plain serialisable props from server pages.

Styling is Tailwind v4 with an `@theme` block in `src/app/globals.css`: brand
brown/cream/gold ramps, semantic surface tokens, serif display headings,
`surface-card`, `hover-lift`, `paper-texture` and a print stylesheet used by the
QR studio, the library card and the SBTR.

## Exports and integrations

- **QR** — `qrcode` renders PNG/SVG on demand at `/api/qr/[barcode]`; payloads are
  `rcc-libro://copy/<barcode>` (scanner apps) and `${SITE_URL}/book/<barcode>`.
  The circulation desk accepts `?scan=borrow&barcode=…` to prefill an issue.
- **PDF** — `src/lib/pdf.ts` builds the borrowing history, SBTR and fine statement
  client-side with `jspdf` + `jspdf-autotable`, in the RCC palette.
- **CSV** — `src/lib/csv.ts` emits RFC-4180 with a UTF-8 BOM and neutralises
  formula injection for the reports screens.
- **E-mail** — Resend sends templates from `src/server/email/templates.ts`; every
  attempt is journalled, and delivery degrades to `queued` when the key is absent.
- **Charts** — Recharts on the analytics page, fed by the aggregate RPCs.

## Security posture

- The service-role key is confined to `src/lib/supabase/admin.ts`, which imports
  `server-only`; a client import fails at build time. It is used for e-mail
  delivery and the cron route, never for a browser-scoped read.
- Redirect targets (`?next=`) are validated to same-origin paths beginning with
  `/`, so the login route cannot be turned into an open redirect.
- RLS is the row-level boundary; the session client is what every page and action
  uses by default.
- `/api/cron/reminders` requires `Authorization: Bearer $CRON_SECRET`, and refuses
  to run unauthenticated in production when the secret is unset (it allows itself
  only in development, where there is no secret to guard).
- Demo credentials in `00009_seed_demo.sql` must be removed or rotated before
  go-live; they are documented in the README and flagged on the admin console.
- The outbound e-mail queue is machine-facing. `claim_email_queue()`,
  `release_stale_email_claims()`, `record_email_result()` and
  `stage_due_reminders()` are revoked from `public, anon, authenticated` by name
  (Supabase's default privileges otherwise grant every new function to both API
  roles) and each one calls `assert_service_runner()`, which reads `auth.uid()` —
  the request JWT's subject claim, which still identifies the caller inside a
  `security definer` body. Both layers are needed: revocation alone would break
  the moment a migration re-grants, and the assertion alone would not stop a
  holder of the service key's neighbouring privileges.
- `security definer` functions run as their owner, so RLS does not narrow what
  they see. Cross-member readers therefore check the caller inside the body:
  `borrower_summary()` answers a non-staff caller with their own numbers
  (`00011`), and `most_active_borrowers()` — a name roster — returns no rows for
  anyone who is not staff.

## Known limits

- `next build` output and a click-through smoke test in the browser are the last
  unverified steps for a fresh integration; run `npm run build` after any schema
  change so the generated Supabase types match.
- Reservation hold expiry has no RPC in the schema, so the queue is managed by the
  desk rather than expiring on a timer.
- Holiday calendars are not modelled: the policy counts calendar days, which is
  what the RCC rule specifies.
- `dashboard_stats()` is intentionally callable by any session (the member
  dashboard renders it), so an anonymous visitor can read aggregate counts:
  titles, copies, active loans, registered users and fine totals. It exposes no
  per-member data. Make it `authenticated`-only if even the totals are
  confidential.
- The `due-reminders` Edge Function and the `pg_cron`/`pg_net` schedule in
  `supabase/edge-cron.sql` are verified against the RPC contracts through a local
  PostgREST instance, not against a live Supabase project or a real Resend send.
