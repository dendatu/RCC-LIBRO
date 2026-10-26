# Database

PostgreSQL on Supabase. Nineteen tables, seventeen enums, sixty-seven indexes,
eighteen triggers on the public tables (plus two on `auth.users` that provision
every new sign-in), three read-model views and forty-six Row Level Security
policies. The migrations install forty-four functions, twenty-eight of which the
app calls as RPCs; the borrowing rules themselves live in Postgres, not in the
client. Row Level Security is enabled on all nineteen tables.

## Applying it

Supabase Dashboard → SQL Editor, one file at a time, in numeric order
(`00001`–`00008`, `00010` and `00011` are structural; `00009` is demo data and
needs the demo logins to exist first — see **Sample data**):

```bash
supabase db push          # or the Supabase CLI equivalent, or paste each file in
npm run schema:sql        # rebuilds schema.sql from the migrations
npm run demo:accounts     # creates the seven demo logins via GoTrue's admin API
npm run validate:sql      # applies everything to Docker Postgres + runs assertions
```

`supabase/local/` (`auth_shim.sql`, `verify.sql`) exists only for the local
validation harness. Never run it against a hosted project — Supabase owns the
`auth` schema, the `anon` / `authenticated` / `service_role` roles and their
default privileges.

## Migrations

| File | Contents |
| ---- | -------- |
| `00001_extensions_and_types.sql` | `pgcrypto`, `citext`, `unaccent`; `immutable_unaccent()` wrapper so the catalogue GIN index is legal; `set_updated_at()`; all sixteen enums |
| `00002_identity_and_rbac.sql` | `users`, `roles`, `user_roles`, `libraries`, `profiles`, `borrower_records`, `settings`, `audit_logs` + seeded branches, roles and policy settings |
| `00003_catalog.sql` | `book_categories`, `books`, `book_copies`, `book_records`; copy/card triggers, `refresh_book_counters()`, `book_inventory_view`, full-text index |
| `00004_circulation.sql` | `borrow_transactions`, `return_transactions`, `fines`, `reservations`, `notifications`, `email_logs`; `sbtr_view`, `book_borrowing_history_view` |
| `00005_domain_functions.sql` | role helpers, `assert_service_runner()`, `setting()`/`setting_number()`, `handle_new_user()`/`handle_user_update()` auth triggers, `compute_due_date()`, `calculate_fine()`, `refresh_borrower_record()`, `mark_overdue_loans()`, `write_audit()` |
| `00006_circulation_rpc.sql` | `evaluate_borrow_eligibility()`, `borrow_book()`, `return_book()`, `extend_due_date()`, `settle_fine()`, `waive_fine()`, `reserve_book()`, `cancel_reservation()`, `stage_due_reminders()` |
| `00007_analytics_rpc.sql` | `dashboard_stats()`, `borrowing_trends()`, `popular_books()`, `popular_categories()`, `branch_usage()`, `most_active_borrowers()`, `borrower_summary()`, `recently_added()`, `recommended_books()`, `search_books()` |
| `00008_row_level_security.sql` | 46 policies, function grants, `anon` revoked from the journals |
| `00009_seed_demo.sql` | preflight, then seven demo logins enriched with roles/SBTR, 20 titles, 46 copies, 30 loans, a fine, a reservation, notifications, audit row — bundled as `seed-demo.sql` |
| `00010_email_queue_claims.sql` | the `sending` lease state, `attempts`, `claim_email_queue()` (`FOR UPDATE SKIP LOCKED`), `release_stale_email_claims()`, `record_email_result()`, service-role-only grants, the claim index |
| `00011_rpc_caller_scoping.sql` | `borrower_summary()` answers a member with their own counts; `most_active_borrowers()` returns nothing to non-staff |

## Sample data

`supabase/seed-demo.sql` is the same content as `00009`, packaged for the SQL
editor. Paste it **after** `schema.sql` — and after the logins exist, because it
refuses to create credentials itself. It is re-runnable on purpose:

- the seven `auth.users` rows must already come from GoTrue: `npm run demo:accounts`,
  **Dashboard → Authentication → Users**, or a real sign-up. The file opens with a
  preflight that names every missing e-mail and aborts **before** it writes, so a
  failure leaves the project exactly as it was;
- an account that already exists keeps **its own** password — the seed only refreshes
  the role, SBTR number, card number and classification fields, and re-provisions the
  `public.users` / `profiles` / `borrower_records` rows if they are absent;
- catalogue rows insert `on conflict do nothing`;
- the circulation-history block skips itself when its deterministic references
  (`RCC-H…`, `-O90001`, `-R00001`) are already present, instead of colliding.

To start the sample data over, run `supabase/cleanup-demo.sql` first — it
removes the demo loans, books and accounts in the order the foreign keys allow.
The password for every seeded account is `RccLibrary#2026`; rotate or delete
these accounts before go-live.

Why the seed must not write `auth.users` itself — measured on a live project:
a row inserted with plain SQL is physically present (`users_pkey` rejects
creating it again) yet invisible or unreadable to GoTrue, so sign-in answers
*"Invalid login credentials"* and, once its `instance_id` matches the project's,
`500 Database error querying schema`. GoTrue-created rows work: an account made
through `POST /auth/v1/admin/users` signed in on the first attempt. Only GoTrue
writes the full shape (`auth.identities` included), so credential creation stays
in the admin API.

If an older seed left broken rows behind, recover in order: paste
`supabase/cleanup-demo.sql`, run `npm run demo:accounts`, paste
`supabase/seed-demo.sql`. The catalogue and the sample history are rebuilt by the
seed; only the demo accounts' ids change, and real accounts (your Google login,
its `admin` grant) are untouched.

## Entity relationships

```
auth.users ──1:1── users ──1:1── profiles
                        ├──1:M── user_roles ──M:1── roles
                        ├──1:1── borrower_records
                        ├──1:M── borrow_transactions ──┬── 1:1 return_transactions
                        │        │                    ├── M:1 book_copies ──M:1── books ──M:1── libraries
                        │        │                    │        │            ├── 1:M book_records
                        │        │                    │        └── M:1 book_categories
                        │        └── M:1 books
                        ├──1:M── fines ──M:1── borrow_transactions, books
                        ├──1:M── reservations ──M:1── books
                        ├──1:M── notifications
                        └──1:M── audit_logs

books ──1:M── book_copies ──1:1── book_records       (the digital book card)
settings (key/value jsonb)      classifications (demo picker lists)
```

Deletion behaviour: member rows cascade (`on delete cascade`); staff references
and librarian attribution use `on delete set null` so history survives a staff
departure; a book cannot be deleted while copies exist (the API refuses it, and
`book_copies.book_id` cascades only for deliberate catalogue removals).

## Where the rules live

Every borrowing decision is made in Postgres, so no client can bypass policy:

| Rule | Function |
| ---- | -------- |
| Max 3 books, 7-day loans, SBTR required, blocked standing | `evaluate_borrow_eligibility()` → `borrow_book()` refuses with a code (`not_eligible`, `library_use_only`, `copy_unavailable`) |
| Due dates | `compute_due_date(section, borrowed_at, days_override)` — reserve: +60 min, or next-day 23:59 from 16:00; reference/periodicals: due at the desk; everything else: +7 days at 23:59 |
| Fines | `calculate_fine()` — ₱1/day rounded up including weekends, ₱2/hour for reserve; lost = price + ₱150, damaged = 50 % of price |
| Counters | `on_copy_change()` → `refresh_book_counters()`; `on_transaction_change()` / `on_fine_change()` → `refresh_borrower_record()`, which also sets `is_blocked` |
| Reserve holds | `reserve_book()` / `cancel_reservation()` renumber `queue_position`; `borrow_book()` promotes the queue head automatically |
| Reminders | `stage_due_reminders()` inserts `email_logs` rows keyed by a unique `dedupe_key` (`reminder:7:<tx>`, `overdue:<tx>`) plus in-app notifications, then `mark_overdue_loans()` |
| Reminder delivery | `claim_email_queue()` leases queued rows with `FOR UPDATE SKIP LOCKED`, `record_email_result()` writes the terminal state, `release_stale_email_claims()` reaps abandoned leases — all three callable by `service_role` only |

Application code calls these through `db.rpc(...)` and renders the returned
message; it never recomputes a fine or a due date.

## Row Level Security

Roles are resolved through `security definer` helpers (`has_role()`,
`is_librarian()`, `is_admin()`, `primary_role()`) that read `user_roles` — policy
predicates must not query a protected table directly or they recurse.

| Table | Who reads | Who writes |
| ----- | --------- | ---------- |
| `books`, `book_categories`, `libraries`, `book_records` | published rows are world-readable (OPAC) | librarian+ |
| `book_copies` | `anon` sees only available/borrowed copies; staff see everything | librarian+ |
| `users`, `profiles`, `borrower_records` | own row, or any staff member | self for profile fields; admin for roles |
| `borrow_transactions`, `return_transactions`, `fines`, `reservations` | own rows, or staff | librarian+ |
| `notifications` | own rows only | staff insert |
| `email_logs`, `audit_logs` | admin only | admin/service role |
| `settings` | authenticated | admin only |

`anon` and `authenticated` are granted `execute` on the RPCs they need;
`search_books()` and `recently_added()` are also callable by `anon` so `/opac`
works without a login. `service_role` (server-only) is used solely where a
request must write outside the caller's own rows — e-mail delivery and the cron
route.

Two consequences of that grant shape are worth knowing before you edit anything:

- Supabase's *default* privileges hand `EXECUTE` on every new `public` function
  to `anon` and `authenticated`. A narrow `grant to service_role` does not take
  that away, so the queue functions in `00010` are revoked from
  `public, anon, authenticated` by name **and** start with
  `assert_service_runner()`, which reads `auth.uid()` — the request JWT's
  subject claim, still the caller's identity inside a `security definer` body.
  Without both layers, `POST /rest/v1/rpc/claim_email_queue` with the public
  `anon` key leases and empties the outbound mail queue.
- A `security definer` function runs as its owner, so Row Level Security does
  not filter what it sees. `00011` scopes the two cross-member analytics RPCs
  inside their bodies for exactly that reason; anything new that reads other
  members' rows needs the same treatment.

## Local harness

`npm run validate:sql` builds a throwaway Postgres 16 container and asserts, among
other things, that:

- an SBTR-less student is refused, and the same student can borrow once the
  tracer number exists;
- in-house stock is refused as `library_use_only`;
- issuing a loan flips the copy, the book's `available_copies` and the borrower's
  `active_loans` together;
- a backdated loan is flagged overdue, and checking it in writes
  `return_transactions.overdue_days` and a pending `fines` row of the exact amount;
- filling all slots makes the next borrow ineligible (`loan_limit_reached`);
- running `stage_due_reminders()` twice stages nothing the second time;
- a pure borrower session sees exactly one `users` row and none of the journals;
- a queued row leases to exactly one runner, an abandoned lease is requeued, a
  row that exhausts its attempts fails permanently, and neither `anon` nor
  `authenticated` can call the lease, the reaper or the delivery writer;
- a member who passes another member's uuid to `borrower_summary()` is answered
  with their own counts, and `most_active_borrowers()` is empty for them but
  populated for staff.

`supabase/local/auth_shim.sql` stands in for the parts of a hosted project the
migrations cannot make themselves: it creates the `anon` / `authenticated` /
`service_role` roles, the `auth.users` table (including its generated
`confirmed_at`, so a script that tries to write it fails here the way it fails on
Supabase) and the seven demo `auth.users` rows that `npm run demo:accounts` would
have created — which is what exercises 00009's preflight in both directions.
`--paste` runs the same assertions through the three consolidated files instead of
the numbered migrations.
