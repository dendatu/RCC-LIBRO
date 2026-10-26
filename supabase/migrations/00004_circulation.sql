-- ============================================================================
-- Migration 00004: circulation — loans, returns, fines, reservations,
--                    notifications and e-mail delivery log
-- ============================================================================

-- ---------------------------------------------------------------------------
-- borrow_transactions — one row per issued copy
-- ---------------------------------------------------------------------------
create table public.borrow_transactions (
  id             uuid primary key default gen_random_uuid(),
  reference_no   text not null unique,
  borrower_id    uuid not null references public.users (id) on delete restrict,
  book_id        uuid not null references public.books (id) on delete restrict,
  copy_id        uuid not null references public.book_copies (id) on delete restrict,
  library_id     bigint not null references public.libraries (id) on delete restrict,
  librarian_id   uuid references public.users (id) on delete set null,
  status         public.borrow_status not null default 'active',
  section        public.circulation_section not null default 'general',
  date_borrowed  timestamptz not null default now(),
  due_date       timestamptz not null,
  date_returned  timestamptz,
  renewals_used  smallint not null default 0,
  max_renewals   smallint not null default 1,
  sbtr_number    text,
  is_overdue     boolean not null default false,
  overdue_days   integer not null default 0,
  fine_charged   numeric(10, 2) not null default 0,
  source         text not null default 'manual',
  notes          text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint borrow_valid_window check (date_returned is null or date_returned >= date_borrowed)
);

create index idx_borrow_borrower  on public.borrow_transactions (borrower_id, status);
create index idx_borrow_book      on public.borrow_transactions (book_id);
create index idx_borrow_copy      on public.borrow_transactions (copy_id);
create index idx_borrow_library   on public.borrow_transactions (library_id);
create index idx_borrow_due_date  on public.borrow_transactions (due_date) where status in ('active', 'overdue');
create index idx_borrow_created   on public.borrow_transactions (date_borrowed desc);

comment on table public.borrow_transactions is
  'Loan ledger. reference_no is the human-readable transaction id shown on SBTR and receipts.';

create trigger trg_borrow_updated_at
  before update on public.borrow_transactions
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- return_transactions — the check-in event for a loan
-- ---------------------------------------------------------------------------
create table public.return_transactions (
  id                    uuid primary key default gen_random_uuid(),
  borrow_transaction_id uuid not null unique references public.borrow_transactions (id) on delete cascade,
  returned_by           uuid references public.users (id) on delete set null,
  date_returned         timestamptz not null default now(),
  condition             public.return_condition not null default 'good',
  is_overdue            boolean not null default false,
  overdue_days          integer not null default 0,
  overdue_hours         numeric(8, 2) not null default 0,
  fine_assessed         numeric(10, 2) not null default 0,
  remarks               text,
  created_at            timestamptz not null default now()
);

create index idx_return_date on public.return_transactions (date_returned desc);

-- ---------------------------------------------------------------------------
-- fines — automatic calculation and settlement tracking
-- ---------------------------------------------------------------------------
create table public.fines (
  id                    uuid primary key default gen_random_uuid(),
  borrower_id           uuid not null references public.users (id) on delete cascade,
  borrow_transaction_id uuid references public.borrow_transactions (id) on delete set null,
  book_id               uuid references public.books (id) on delete set null,
  type                  public.fine_type not null,
  amount                numeric(10, 2) not null check (amount >= 0),
  status                public.fine_status not null default 'pending',
  computed_from         timestamptz,
  computed_to           timestamptz,
  unit_count            numeric(10, 2) not null default 1,
  currency              text not null default 'PHP',
  assessed_by           uuid references public.users (id) on delete set null,
  paid_at               timestamptz,
  paid_via              text,
  waiver_reason         text,
  waived_by             uuid references public.users (id) on delete set null,
  notes                 text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index idx_fines_borrower on public.fines (borrower_id, status);
create index idx_fines_tx       on public.fines (borrow_transaction_id);

create trigger trg_fines_updated_at
  before update on public.fines
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- reservations — online borrowing queue
-- ---------------------------------------------------------------------------
create table public.reservations (
  id           uuid primary key default gen_random_uuid(),
  book_id      uuid not null references public.books (id) on delete cascade,
  copy_id      uuid references public.book_copies (id) on delete set null,
  borrower_id  uuid not null references public.users (id) on delete cascade,
  status       public.reservation_status not null default 'waiting',
  queue_position smallint not null default 1,
  held_until   timestamptz,
  requested_at timestamptz not null default now(),
  ready_at     timestamptz,
  fulfilled_at timestamptz,
  cancelled_at timestamptz,
  notes        text,
  updated_at   timestamptz not null default now(),
  -- a borrower may not queue the same title twice at once
  constraint reservation_unique_active unique (book_id, borrower_id, status)
);

create index idx_reservations_borrower on public.reservations (borrower_id, status);
create index idx_reservations_book     on public.reservations (book_id, status, requested_at);

create trigger trg_reservations_updated_at
  before update on public.reservations
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- notifications — in-app notification centre
-- ---------------------------------------------------------------------------
create table public.notifications (
  id           bigint generated always as identity primary key,
  user_id      uuid not null references public.users (id) on delete cascade,
  type         public.notification_type not null,
  title        text not null,
  body         text not null,
  link         text,
  metadata     jsonb not null default '{}'::jsonb,
  is_read      boolean not null default false,
  read_at      timestamptz,
  created_at   timestamptz not null default now()
);

create index idx_notifications_user on public.notifications (user_id, is_read, created_at desc);

-- ---------------------------------------------------------------------------
-- email_logs — outbound e-mail journal with de-duplication
-- ---------------------------------------------------------------------------
create table public.email_logs (
  id             bigint generated always as identity primary key,
  recipient      citext not null,
  user_id        uuid references public.users (id) on delete set null,
  template       text not null,
  subject        text not null,
  body           text,
  -- unique idempotency key, e.g. reminder:7:<transaction uuid>
  dedupe_key     text not null unique,
  status         public.email_status not null default 'queued',
  provider       text not null default 'resend',
  provider_id    text,
  error          text,
  notification_id bigint references public.notifications (id) on delete set null,
  borrow_transaction_id uuid references public.borrow_transactions (id) on delete set null,
  queued_at      timestamptz not null default now(),
  sent_at        timestamptz
);

create index idx_email_logs_status on public.email_logs (status, queued_at);
create index idx_email_logs_user   on public.email_logs (user_id, sent_at desc);

comment on column public.email_logs.dedupe_key is
  'Idempotency guard: the reminder job cannot send the same stage twice for one loan.';

-- ---------------------------------------------------------------------------
-- Views used by SBTR, book cards and dashboards
-- ---------------------------------------------------------------------------
-- security_invoker keeps the tracer record inside the caller's RLS scope: without
-- it the view runs as its owner and leaks every member's borrowing history.
drop view if exists public.sbtr_view;
create view public.sbtr_view
with (security_invoker = true)
as
select
  bt.id,
  bt.reference_no,
  bt.borrower_id,
  u.full_name           as borrower_name,
  u.email               as borrower_email,
  u.contact_number,
  p.borrower_type,
  p.education_level,
  p.college_program,
  p.faculty_department,
  p.senior_high_track,
  p.sbtr_number,
  b.title               as book_title,
  b.author              as book_author,
  b.accession_number,
  b.call_number,
  l.name                as library_name,
  bt.section,
  bt.date_borrowed,
  bt.due_date,
  bt.date_returned,
  bt.status,
  bt.is_overdue,
  bt.overdue_days,
  bt.fine_charged
from public.borrow_transactions bt
join public.users u          on u.id = bt.borrower_id
join public.books b          on b.id = bt.book_id
join public.libraries l      on l.id = bt.library_id
left join public.profiles p  on p.user_id = bt.borrower_id;

drop view if exists public.book_borrowing_history_view;
create view public.book_borrowing_history_view
with (security_invoker = true)
as
select
  bt.id,
  bt.book_id,
  bt.copy_id,
  b.title,
  b.author,
  b.accession_number,
  b.call_number,
  br.barcode,
  bt.borrower_id,
  u.full_name as borrower_name,
  case
    when p.borrower_type = 'faculty' then initcap(replace(p.faculty_department::text, '_', ' '))
    else coalesce(
      replace(initcap(p.education_level::text), '_', ' '),
      replace(initcap(p.college_program::text), '_', ' ')
    )
  end as borrower_classification,
  p.section,
  bt.date_borrowed,
  bt.due_date,
  bt.date_returned,
  bt.status,
  rt.condition as return_condition,
  rt.fine_assessed
from public.borrow_transactions bt
join public.books b            on b.id = bt.book_id
left join public.book_copies br on br.id = bt.copy_id
join public.users u            on u.id = bt.borrower_id
left join public.profiles p    on p.user_id = bt.borrower_id
left join public.return_transactions rt on rt.borrow_transaction_id = bt.id;
