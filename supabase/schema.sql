-- ===========================================================================
-- RCC LIBRO — Consolidated schema (structure, no demo data)
-- Republic Central Colleges, Angeles City Campus
--
-- Paste this whole file into the Supabase SQL Editor; it runs as one script in
-- the order listed below.
--
-- Source migrations:
--   00001_extensions_and_types.sql
--   00002_identity_and_rbac.sql
--   00003_catalog.sql
--   00004_circulation.sql
--   00005_domain_functions.sql
--   00006_circulation_rpc.sql
--   00007_analytics_rpc.sql
--   00008_row_level_security.sql
--   00010_email_queue_claims.sql
--   00011_rpc_caller_scoping.sql
--   00012_college_education_levels.sql
--
-- Google OAuth: migration 00005 installs an "on insert/update on auth.users" trigger,
-- so every provider (Google, e-mail/password, magic link) provisions public.users,
-- profiles, user_roles and borrower_records automatically on first sign-in.
-- ===========================================================================


-- >>>>>>>>>>>>>>>>>>>>>>>>>> 00001_extensions_and_types.sql <<<<<<<<<<<<<<<<<<<<<<<<

-- ============================================================================
-- RCC LIBRO — Library Inventory and Book Recording Organizer
-- Republic Central Colleges, Angeles City Campus
-- Migration 00001: extensions, enum types, shared helpers
-- ============================================================================

create extension if not exists "pgcrypto";
create extension if not exists "citext";

-- ---------------------------------------------------------------------------
-- Shared "updated at" trigger
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Enum types
-- ---------------------------------------------------------------------------

-- Role-based access control
create type public.role_slug as enum ('borrower', 'librarian', 'admin');

-- Borrower classification
create type public.borrower_type as enum ('student', 'faculty');

-- Academic levels (Kinder -> Grade 12, plus Graduate School)
create type public.education_level as enum (
  'kinder',
  'grade_1', 'grade_2', 'grade_3', 'grade_4', 'grade_5', 'grade_6',
  'grade_7', 'grade_8', 'grade_9', 'grade_10',
  'grade_11', 'grade_12',
  'graduate'
);

-- Senior high school tracks
create type public.senior_high_track as enum ('pba', 'ssh', 'peat', 'phs');

-- College / graduate programs offered at RCC
create type public.college_program as enum (
  'abel', 'bsa', 'bsce', 'bsit', 'bsba', 'bshm', 'bstm', 'beed',
  'bsed_english', 'bsed_mathematics', 'bsed_filipino', 'graduate_school'
);

-- Faculty departments
create type public.faculty_department as enum (
  'elementary', 'high_school', 'college', 'graduate_school'
);

-- Physical copy status
create type public.copy_status as enum (
  'available', 'borrowed', 'reserved', 'damaged', 'lost', 'maintenance'
);

-- Roll-up status shown on the catalogue record
create type public.book_status as enum (
  'available', 'borrowed', 'reserved', 'damaged', 'lost', 'processing'
);

-- Library sections governed by their own circulation rules
create type public.circulation_section as enum (
  'general',
  'filipiniana',
  'home_reading',
  'fiction',
  'newly_acquired',
  'reserve',
  'research_output',
  'reference',
  'periodicals'
);

create type public.borrow_status as enum (
  'active', 'returned', 'overdue', 'lost', 'damaged', 'cancelled'
);

create type public.return_condition as enum ('good', 'damaged', 'lost');

create type public.fine_type as enum (
  'overdue_daily', 'reserve_hourly', 'lost_book', 'damaged_book', 'manual'
);

create type public.fine_status as enum ('pending', 'paid', 'waived', 'disputed');

create type public.reservation_status as enum (
  'waiting', 'ready', 'fulfilled', 'cancelled', 'expired'
);

create type public.notification_type as enum (
  'due_reminder', 'overdue', 'reservation_ready', 'fine_assessed', 'fine_settled',
  'account', 'system'
);

create type public.email_status as enum ('queued', 'sent', 'bounced', 'failed', 'skipped');

create type public.account_status as enum ('active', 'suspended', 'graduated', 'inactive');


-- >>>>>>>>>>>>>>>>>>>>>>>>>> 00002_identity_and_rbac.sql <<<<<<<<<<<<<<<<<<<<<<<<

-- ============================================================================
-- Migration 00002: identity, RBAC, library branches, borrower profiles
-- ============================================================================

-- ---------------------------------------------------------------------------
-- users — application account, 1:1 with auth.users
-- ---------------------------------------------------------------------------
create table public.users (
  id             uuid primary key references auth.users (id) on delete cascade,
  full_name      text        not null default '',
  email          citext      not null unique,
  avatar_url     text,
  contact_number text,
  is_active      boolean     not null default true,
  last_login_at  timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint users_full_name_length check (char_length(full_name) <= 160)
);

comment on table public.users is
  'Application account record. Provisioned automatically from auth.users on sign-up (Google SSO or email).';

create trigger trg_users_updated_at
  before update on public.users
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- roles — RBAC catalogue
-- ---------------------------------------------------------------------------
create table public.roles (
  id          bigint generated always as identity primary key,
  slug        public.role_slug not null unique,
  name        text             not null,
  description text,
  -- rank drives "who may manage whom" in the admin console
  rank        smallint         not null default 10,
  created_at  timestamptz      not null default now()
);

insert into public.roles (slug, name, description, rank) values
  ('borrower',  'Borrower',  'Student or faculty member who borrows library materials.', 10),
  ('librarian', 'Librarian', 'Circulation staff: manages catalogue, loans, returns, fines.', 20),
  ('admin',     'Administrator', 'Full system access: users, policies, settings, audit logs.', 30);

-- ---------------------------------------------------------------------------
-- user_roles — role assignment (a user may hold more than one role)
-- ---------------------------------------------------------------------------
create table public.user_roles (
  user_id    uuid   not null references public.users (id) on delete cascade,
  role_slug  public.role_slug not null,
  granted_by uuid   references public.users (id) on delete set null,
  granted_at timestamptz not null default now(),
  primary key (user_id, role_slug)
);

create index idx_user_roles_role on public.user_roles (role_slug);

-- ---------------------------------------------------------------------------
-- libraries — RCC branch libraries, each with its own inventory
-- ---------------------------------------------------------------------------
create table public.libraries (
  id          bigint generated always as identity primary key,
  code        text        not null unique,
  name        text        not null,
  description text,
  address     text,
  contact_number text,
  email       citext,
  is_active   boolean     not null default true,
  sort_order  smallint    not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger trg_libraries_updated_at
  before update on public.libraries
  for each row execute function public.set_updated_at();

insert into public.libraries (code, name, description, address, sort_order) values
  ('EL',  'Elementary Library',
         'Picture books, home reading and early literacy collection for Kinder to Grade 6.',
         'RCC Building A — Ground Floor, Angeles City', 1),
  ('HS',  'High School Library',
         'Junior and senior high school collection including Filipiniana and reserve books.',
         'RCC Building B — Second Floor, Angeles City', 2),
  ('CGS', 'College and Graduate School Library',
         'College, professional and graduate research collection, reference and periodicals.',
         'RCC Main Building — Third Floor, Angeles City', 3);

-- ---------------------------------------------------------------------------
-- profiles — library membership details for a borrower
-- ---------------------------------------------------------------------------
create table public.profiles (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null unique references public.users (id) on delete cascade,
  borrower_type       public.borrower_type,
  education_level     public.education_level,
  senior_high_track   public.senior_high_track,
  college_program     public.college_program,
  faculty_department  public.faculty_department,
  -- Student Book Tracer Record number: required before a student may borrow
  sbtr_number         text unique,
  id_number           text,
  section             text,
  enrollment_year     smallint check (enrollment_year between 1900 and 2200),
  card_number         text unique,
  avatar_url          text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint profile_needs_classification check (
    borrower_type is null
    or (borrower_type = 'student' and (education_level is not null or college_program is not null))
    or (borrower_type = 'faculty' and faculty_department is not null)
  )
);

comment on column public.profiles.sbtr_number is
  'Student Book Tracer Record number. Borrowing policy requires an active SBTR for students.';

create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- borrower_records — circulation entitlement + rolling statistics
-- Maintained by triggers; used to enforce the borrowing policy quickly.
-- ---------------------------------------------------------------------------
create table public.borrower_records (
  user_id               uuid primary key references public.users (id) on delete cascade,
  status                public.account_status not null default 'active',
  borrowing_limit       smallint not null default 3,
  loan_period_days      smallint not null default 7,
  active_loans          smallint not null default 0,
  overdue_loans         smallint not null default 0,
  outstanding_fines     numeric(10, 2) not null default 0,
  total_loans           integer not null default 0,
  last_borrowed_at      timestamptz,
  is_blocked            boolean not null default false,
  block_reason          text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

comment on table public.borrower_records is
  'Trigger-maintained snapshot of a borrower''s standing: entitlements, counters and block state.';

create index idx_borrower_records_status on public.borrower_records (status);

create trigger trg_borrower_records_updated_at
  before update on public.borrower_records
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- settings — admin-configurable policy values (fine rates, limits, rules)
-- ---------------------------------------------------------------------------
create table public.settings (
  key          text primary key,
  value        jsonb not null,
  label        text not null,
  description  text,
  group_name   text not null default 'general',
  updated_by   uuid references public.users (id) on delete set null,
  updated_at   timestamptz not null default now()
);

create trigger trg_settings_updated_at
  before update on public.settings
  for each row execute function public.set_updated_at();

insert into public.settings (key, value, label, description, group_name) values
  ('borrowing.student.max_books',        '3',        'Maximum borrowed books',        'Students may hold at most this many books at one time.', 'circulation'),
  ('borrowing.student.duration_days',    '7',        'Loan period (days)',            'Default due date offset for general collection loans.', 'circulation'),
  ('borrowing.fine.per_day',             '1.00',     'Overdue fine per day (PHP)',    'Charged per book, per calendar day including weekends and holidays.', 'fines'),
  ('borrowing.fine.reserve_per_hour',    '2.00',     'Reserve book fine per hour (PHP)', 'Charged when a reserve book is kept past its allowed window.', 'fines'),
  ('borrowing.reserve.duration_minutes', '60',       'Reserve book in-library hours (minutes)', 'Reserve books are for one hour of in-library use.', 'circulation'),
  ('borrowing.reserve.takehome_hour',    '16',       'Reserve take-home hour (24h)',  'From this hour a reserve book may be taken home and returned the next school day.', 'circulation'),
  ('borrowing.reference.library_only',   'true',     'Reference section is library use only', 'Dictionaries, encyclopedias and atlases cannot leave the library.', 'circulation'),
  ('borrowing.periodicals.library_only', 'true',     'Periodicals are library use only', 'Magazines, newspapers, journals and clippings cannot be borrowed.', 'circulation'),
  ('borrowing.block_on_unresolved_fines','100.00',   'Fine threshold that blocks borrowing (PHP)', 'Borrowing is refused when unresolved penalties meet or exceed this amount.', 'fines'),
  ('notifications.reminder_days',        '[7, 3, 1]','Due-date reminder lead times',  'Days before the due date at which reminder e-mails are sent.', 'notifications'),
  ('notifications.sender_name',          '"RCC LIBRO"', 'Notification sender name',   'Display name used in outgoing e-mail.', 'notifications'),
  ('notifications.sender_email',         '"library@rcc.edu.ph"', 'Notification sender e-mail', 'Reply-to address for notification e-mail.', 'notifications'),
  ('system.currency',                    '"PHP"',    'Currency', 'Fines are recorded in this currency.', 'general'),
  ('system.institution',                 '"Republic Central Colleges — Angeles City Campus"', 'Institution name', 'Shown across printed reports.', 'general');

-- ---------------------------------------------------------------------------
-- audit_logs — tamper-evident record of every significant action
-- ---------------------------------------------------------------------------
create table public.audit_logs (
  id          bigint generated always as identity primary key,
  actor_id    uuid references public.users (id) on delete set null,
  action      text not null,
  entity_type text not null,
  entity_id   text,
  metadata    jsonb not null default '{}'::jsonb,
  ip_address  text,
  user_agent  text,
  created_at  timestamptz not null default now()
);

create index idx_audit_logs_created_at on public.audit_logs (created_at desc);
create index idx_audit_logs_actor       on public.audit_logs (actor_id, created_at desc);
create index idx_audit_logs_entity      on public.audit_logs (entity_type, entity_id);
create index idx_audit_logs_action      on public.audit_logs (action);


-- >>>>>>>>>>>>>>>>>>>>>>>>>> 00003_catalog.sql <<<<<<<<<<<<<<<<<<<<<<<<

-- ============================================================================
-- Migration 00003: catalogue — categories, books, physical copies, digital cards
-- ============================================================================

-- ---------------------------------------------------------------------------
-- book_categories — topical classification, optionally nested
-- ---------------------------------------------------------------------------
create table public.book_categories (
  id          bigint generated always as identity primary key,
  name        text not null unique,
  slug        text not null unique,
  description text,
  parent_id   bigint references public.book_categories (id) on delete set null,
  sort_order  smallint not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint category_not_self_parent check (parent_id is null or parent_id <> id)
);

create trigger trg_book_categories_updated_at
  before update on public.book_categories
  for each row execute function public.set_updated_at();

insert into public.book_categories (name, slug, description, sort_order) values
  ('General Reference',       'general-reference',  'Dictionaries, encyclopedias, atlases and other library-use-only references.', 1),
  ('Filipiniana',             'filipiniana',        'Works about the Philippines, by Filipino authors.', 2),
  ('Fiction & Literature',    'fiction',            'Novels, short stories and poetry.', 3),
  ('Home Reading',            'home-reading',       'Pleasure reading titles for younger readers.', 4),
  ('Science & Technology',    'science-technology', 'Pure and applied science, IT and engineering.', 5),
  ('Business & Accountancy',  'business',           'Accountancy, management, marketing and entrepreneurship.', 6),
  ('Education',               'education',          'Teaching methods, curriculum and classroom practice.', 7),
  ('Engineering & Architecture','engineering',      'Civil engineering and architecture.', 8),
  ('Hospitality & Tourism',   'hospitality-tourism','Hotel management and tourism studies.', 9),
  ('Health & Nursing',        'health-nursing',     'Nursing, midwifery and allied health.', 10),
  ('Research & Theses',       'research-theses',    'Institutional research output and theses.', 11),
  ('Periodicals',             'periodicals',        'Magazines, newspapers, journals and clippings.', 12);

-- ---------------------------------------------------------------------------
-- books — one row per catalogue title
-- ---------------------------------------------------------------------------
create table public.books (
  id               uuid primary key default gen_random_uuid(),
  accession_number text not null unique,
  call_number      text not null,
  isbn             text,
  title            text not null,
  author           text not null default '',
  subject          text,
  publisher        text,
  publication_year smallint check (publication_year between 1400 and 2200),
  edition          text,
  language         text not null default 'English',
  category_id      bigint references public.book_categories (id) on delete set null,
  library_id       bigint not null references public.libraries (id) on delete restrict,
  section          public.circulation_section not null default 'general',
  description      text,
  cover_image_url  text,
  total_copies     smallint not null default 0,
  available_copies smallint not null default 0,
  status           public.book_status not null default 'processing',
  qr_code_url      text,
  added_by         uuid references public.users (id) on delete set null,
  is_published     boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index idx_books_library      on public.books (library_id);
create index idx_books_category     on public.books (category_id);
create index idx_books_section      on public.books (section);
create index idx_books_status       on public.books (status);
create index idx_books_created_at   on public.books (created_at desc);
create index idx_books_call_number  on public.books (call_number);
create index idx_books_search       on public.books
  using gin (to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(author, '')));

comment on index idx_books_search is
  'Full-text index over title + author powering OPAC search.';

create trigger trg_books_updated_at
  before update on public.books
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- book_copies — individual physical items carrying their own barcode/accession
-- ---------------------------------------------------------------------------
create table public.book_copies (
  id               uuid primary key default gen_random_uuid(),
  book_id          uuid not null references public.books (id) on delete cascade,
  barcode          text not null unique,
  accession_number text unique,
  copy_number      smallint not null default 1,
  status           public.copy_status not null default 'available',
  condition        text not null default 'Good',
  shelf_location   text,
  acquisition_date date,
  acquisition_price numeric(10, 2),
  source           text,
  is_library_use_only boolean not null default false,
  notes            text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint book_copies_copy_number_positive check (copy_number >= 1)
);

create index idx_book_copies_book  on public.book_copies (book_id);
create index idx_book_copies_status on public.book_copies (status);

create trigger trg_book_copies_updated_at
  before update on public.book_copies
  for each row execute function public.set_updated_at();

-- Reference and periodicals items can never leave the library
create or replace function public.enforce_copy_loanability()
returns trigger
language plpgsql
as $$
declare
  v_section public.circulation_section;
begin
  select section into v_section from public.books where id = new.book_id;
  if v_section in ('reference', 'periodicals') then
    new.is_library_use_only = true;
  end if;
  return new;
end;
$$;

create trigger trg_book_copies_loanability
  before insert or update on public.book_copies
  for each row execute function public.enforce_copy_loanability();

-- ---------------------------------------------------------------------------
-- book_records — the digital book card issued per physical copy.
-- Mirrors the traditional pocket card and carries the printable QR payload.
-- ---------------------------------------------------------------------------
create table public.book_records (
  id               uuid primary key default gen_random_uuid(),
  book_id          uuid not null references public.books (id) on delete cascade,
  copy_id          uuid unique references public.book_copies (id) on delete cascade,
  title            text not null,
  author           text not null default '',
  accession_number text,
  call_number      text,
  qr_payload       text not null,
  qr_image_url     text,
  issued_at        timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index idx_book_records_book on public.book_records (book_id);

create trigger trg_book_records_updated_at
  before update on public.book_records
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Keep books.total_copies / available_copies / status in sync with copies
-- ---------------------------------------------------------------------------
create or replace function public.refresh_book_counters(p_book_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.books b
     set total_copies = coalesce(s.total, 0),
         available_copies = coalesce(s.available, 0),
         status = case
           when coalesce(s.total, 0) = 0 then 'processing'::public.book_status
           when coalesce(s.available, 0) > 0 then 'available'::public.book_status
           when coalesce(s.lost, 0) > 0 and coalesce(s.available, 0) = 0 then 'lost'::public.book_status
           when coalesce(s.damaged, 0) > 0 and coalesce(s.available, 0) = 0 then 'damaged'::public.book_status
           when coalesce(s.reserved, 0) > 0 then 'reserved'::public.book_status
           else 'borrowed'::public.book_status
         end
    from (
      select count(*) as total,
             count(*) filter (where status = 'available') as available,
             count(*) filter (where status = 'lost') as lost,
             count(*) filter (where status = 'damaged') as damaged,
             count(*) filter (where status = 'reserved') as reserved
        from public.book_copies
       where book_id = p_book_id
    ) s
   where b.id = p_book_id;
$$;

create or replace function public.on_copy_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    perform public.refresh_book_counters(new.book_id);
  elsif tg_op = 'DELETE' then
    perform public.refresh_book_counters(old.book_id);
  else
    perform public.refresh_book_counters(old.book_id);
    if new.book_id is distinct from old.book_id or new.status is distinct from old.status then
      perform public.refresh_book_counters(new.book_id);
    end if;
  end if;
  return null;
end;
$$;

create trigger trg_book_copies_counters
  after insert or update or delete on public.book_copies
  for each row execute function public.on_copy_change();

-- ---------------------------------------------------------------------------
-- Auto-issue a digital book card whenever a physical copy is registered
-- ---------------------------------------------------------------------------
create or replace function public.on_copy_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_book public.books;
begin
  select * into v_book from public.books where id = new.book_id;
  insert into public.book_records (book_id, copy_id, title, author, accession_number, call_number, qr_payload)
  values (
    new.book_id, new.id, v_book.title, v_book.author,
    coalesce(new.accession_number, v_book.accession_number),
    v_book.call_number,
    'rcc-libro://copy/' || new.barcode
  )
  on conflict (copy_id) do nothing;
  return new;
end;
$$;

create trigger trg_book_records_issue
  after insert on public.book_copies
  for each row execute function public.on_copy_created();

-- Keep card metadata aligned if the catalogue record is edited
create or replace function public.on_book_updated()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.book_records
     set title = new.title,
         author = new.author,
         call_number = new.call_number
   where book_id = new.id;
  return new;
end;
$$;

create trigger trg_book_records_sync
  after update of title, author, call_number on public.books
  for each row execute function public.on_book_updated();

-- ---------------------------------------------------------------------------
-- Convenience view used by OPAC and dashboards
-- ---------------------------------------------------------------------------
-- security_invoker makes the view evaluate under the calling user's Row Security
-- policies. A plain view runs as its owner and would hand every row to any
-- authenticated caller, so this flag is load-bearing, not cosmetic.
drop view if exists public.book_inventory_view;
create view public.book_inventory_view
with (security_invoker = true)
as
select
  b.id,
  b.accession_number,
  b.call_number,
  b.isbn,
  b.title,
  b.author,
  b.subject,
  b.publisher,
  b.publication_year,
  b.edition,
  b.language,
  b.description,
  b.cover_image_url,
  b.qr_code_url,
  b.status,
  b.section,
  b.total_copies,
  b.available_copies,
  b.created_at,
  b.updated_at,
  l.id   as library_id,
  l.code as library_code,
  l.name as library_name,
  c.id   as category_id,
  c.name as category_name,
  c.slug as category_slug
from public.books b
join public.libraries l on l.id = b.library_id
left join public.book_categories c on c.id = b.category_id
where b.is_published;

comment on view public.book_inventory_view is
  'Published catalogue joined with branch and category — the read model used by search and lists.';


-- >>>>>>>>>>>>>>>>>>>>>>>>>> 00004_circulation.sql <<<<<<<<<<<<<<<<<<<<<<<<

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


-- >>>>>>>>>>>>>>>>>>>>>>>>>> 00005_domain_functions.sql <<<<<<<<<<<<<<<<<<<<<<<<

-- ============================================================================
-- Migration 00005: domain functions — profile provisioning, RBAC helpers,
--                   borrowing policy engine, fines, analytics
-- ============================================================================

create sequence public.borrow_reference_seq start 1001;

-- ---------------------------------------------------------------------------
-- RBAC helpers (security definer: safe to call from RLS policies)
-- ---------------------------------------------------------------------------
create or replace function public.has_role(p_user_id uuid, p_role public.role_slug)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
     where user_id = p_user_id and role_slug = p_role
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_role(auth.uid(), 'admin');
$$;

create or replace function public.is_librarian()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_role(auth.uid(), 'librarian') or public.has_role(auth.uid(), 'admin');
$$;

-- Machine-facing jobs: refuse any caller that carries a member's subject claim.
-- `auth.uid()` reads the request JWT, so unlike current_user it still reports
-- the caller inside SECURITY DEFINER functions; a service-role key has no subject.
create or replace function public.assert_service_runner()
returns void
language plpgsql
stable
as $$
begin
  if auth.uid() is not null then
    raise exception 'this job is restricted to the service role'
      using errcode = '42501';
  end if;
end;
$$;

create or replace function public.primary_role(p_user_id uuid)
returns public.role_slug
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select r.slug
       from public.user_roles ur
       join public.roles r on r.slug = ur.role_slug
      where ur.user_id = p_user_id
      order by r.rank desc
      limit 1),
    'borrower'::public.role_slug
  );
$$;

-- ---------------------------------------------------------------------------
-- Settings accessor
-- ---------------------------------------------------------------------------
create or replace function public.setting(p_key text, p_default jsonb default 'null'::jsonb)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select value from public.settings where key = p_key), p_default);
$$;

create or replace function public.setting_number(p_key text, p_default numeric default 0)
returns numeric
language sql
stable
set search_path = public
as $$
  select coalesce((public.setting(p_key))::text::numeric, p_default);
$$;

-- ---------------------------------------------------------------------------
-- Auto-provision an application account whenever Supabase Auth creates a user
-- (Google SSO and e-mail sign-up both land here).
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email   text := coalesce(new.email, '');
  v_name    text := coalesce(
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    nullif(new.raw_user_meta_data ->> 'name', ''),
    nullif(split_part(v_email, '@', 1), ''),
    'RCC Member'
  );
  v_avatar  text := coalesce(
    nullif(new.raw_user_meta_data ->> 'avatar_url', ''),
    nullif(new.raw_user_meta_data ->> 'picture', '')
  );
begin
  insert into public.users (id, full_name, email, avatar_url)
  values (new.id, v_name, v_email, v_avatar)
  on conflict (id) do update
    set full_name = excluded.full_name,
        email     = excluded.email,
        avatar_url = coalesce(excluded.avatar_url, public.users.avatar_url);

  insert into public.user_roles (user_id, role_slug)
  values (new.id, 'borrower')
  on conflict do nothing;

  insert into public.profiles (user_id, avatar_url)
  values (new.id, v_avatar)
  on conflict (user_id) do nothing;

  insert into public.borrower_records (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  insert into public.notifications (user_id, type, title, body, link)
  values (new.id, 'account', 'Welcome to RCC LIBRO',
          'Your library account is ready. Complete your borrower profile to start borrowing.',
          '/dashboard/profile');

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Keep the mirrored account row in sync when auth metadata changes
create or replace function public.handle_user_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.users
     set email = coalesce(new.email, email),
         full_name = coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), full_name),
         avatar_url = coalesce(nullif(new.raw_user_meta_data ->> 'avatar_url', ''),
                               nullif(new.raw_user_meta_data ->> 'picture', ''), avatar_url)
   where id = new.id;
  return new;
end;
$$;

drop trigger if exists on_auth_user_updated on auth.users;
create trigger on_auth_user_updated
  after update of email, raw_user_meta_data on auth.users
  for each row execute function public.handle_user_update();

-- ---------------------------------------------------------------------------
-- Due-date rules per section
-- ---------------------------------------------------------------------------
create or replace function public.compute_due_date(
  p_section public.circulation_section,
  p_borrowed_at timestamptz default now(),
  p_days_override smallint default null
)
returns timestamptz
language sql
stable
set search_path = public
as $$
  select case
    when p_section = 'reserve' then
      -- One hour of in-library use; from the take-home hour the book may go
      -- home and is due at closing time on the next school day.
      case
        when extract(hour from p_borrowed_at) >= public.setting_number('borrowing.reserve.takehome_hour', 16)
          then date_trunc('day', p_borrowed_at + interval '1 day')
               + interval '23 hours 59 minutes'
        else p_borrowed_at
             + make_interval(mins => public.setting_number('borrowing.reserve.duration_minutes', 60)::int)
      end
    when p_section in ('reference', 'periodicals') then p_borrowed_at
    else
      date_trunc('day', p_borrowed_at)
        + make_interval(days => coalesce(p_days_override,
            public.setting_number('borrowing.student.duration_days', 7)::int)::int)
        + interval '23 hours 59 minutes'
  end;
$$;

-- ---------------------------------------------------------------------------
-- Fine calculator
--   General collection : PHP 1 per day (weekends and holidays included)
--   Reserve books      : PHP 2 per hour overdue
-- ---------------------------------------------------------------------------
create or replace function public.calculate_fine(
  p_section public.circulation_section,
  p_due_date timestamptz,
  p_as_of timestamptz default now()
)
returns numeric(10, 2)
language sql
stable
set search_path = public
as $$
  select case
    when p_as_of <= p_due_date then 0
    when p_section = 'reserve' then
      ceil(extract(epoch from (p_as_of - p_due_date)) / 3600.0)
        * public.setting_number('borrowing.fine.reserve_per_hour', 2)
    else
      greatest(1, ceil(extract(epoch from (p_as_of - p_due_date)) / 86400.0)::int)
        * public.setting_number('borrowing.fine.per_day', 1)
  end;
$$;

-- ---------------------------------------------------------------------------
-- Borrower standing snapshot, refreshed by triggers
-- ---------------------------------------------------------------------------
create or replace function public.refresh_borrower_record(p_user_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.borrower_records br
     set active_loans = s.active,
         overdue_loans = s.overdue,
         outstanding_fines = s.fines,
         total_loans = s.total,
         last_borrowed_at = s.last_borrowed,
         is_blocked = s.overdue > 0
                      or s.fines >= public.setting_number('borrowing.block_on_unresolved_fines', 100),
         block_reason = case
           when s.overdue > 0 and s.fines >= public.setting_number('borrowing.block_on_unresolved_fines', 100)
             then 'Overdue loans and unresolved penalties.'
           when s.overdue > 0 then 'Unreturned books are past their due date.'
           when s.fines >= public.setting_number('borrowing.block_on_unresolved_fines', 100)
             then 'Unresolved penalties exceed the allowed threshold.'
         end
    from (
      select
        (select count(*) from public.borrow_transactions
          where borrower_id = p_user_id and status in ('active', 'overdue'))::int as active,
        (select count(*) from public.borrow_transactions
          where borrower_id = p_user_id
            and status in ('active', 'overdue') and due_date < now())::int as overdue,
        (select coalesce(sum(amount), 0) from public.fines
          where borrower_id = p_user_id and status = 'pending')::numeric as fines,
        (select count(*) from public.borrow_transactions
          where borrower_id = p_user_id)::int as total,
        (select max(date_borrowed) from public.borrow_transactions
          where borrower_id = p_user_id) as last_borrowed
    ) s
   where br.user_id = p_user_id;
$$;

create or replace function public.on_transaction_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    perform public.refresh_borrower_record(old.borrower_id);
    perform public.refresh_book_counters(old.book_id);
    return old;
  end if;

  perform public.refresh_borrower_record(new.borrower_id);
  perform public.refresh_book_counters(new.book_id);

  if tg_op = 'UPDATE' then
    if old.book_id is distinct from new.book_id then
      perform public.refresh_book_counters(old.book_id);
    end if;
  end if;

  return new;
end;
$$;

create trigger trg_borrow_refresh
  after insert or update or delete on public.borrow_transactions
  for each row execute function public.on_transaction_change();

create or replace function public.on_fine_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    perform public.refresh_borrower_record(old.borrower_id);
    return old;
  end if;
  perform public.refresh_borrower_record(new.borrower_id);
  return new;
end;
$$;

create trigger trg_fines_refresh
  after insert or update or delete on public.fines
  for each row execute function public.on_fine_change();

-- Mark loans overdue as they age (called by the scheduled job)
create or replace function public.mark_overdue_loans()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  with updated as (
    update public.borrow_transactions
       set status = 'overdue',
           is_overdue = true,
           overdue_days = greatest(1, ceil(extract(epoch from (now() - due_date)) / 86400.0)::int)
     where status = 'active' and due_date < now()
    returning id, borrower_id, book_id
  ),
  copies as (
    update public.book_copies c
       set status = 'borrowed'
      from public.borrow_transactions bt
     where bt.copy_id = c.id and bt.id in (select id from updated)
       and bt.status in ('active', 'overdue') and c.status = 'available'
    returning c.book_id
  )
  select count(*) into v_count from updated;

  update public.books b
     set status = 'borrowed'
    where b.id in (select book_id from public.borrow_transactions
                    where status = 'overdue' and date_returned is null)
      and b.status <> 'borrowed';

  return v_count;
end;
$$;

-- ---------------------------------------------------------------------------
-- Audit trail writer
-- ---------------------------------------------------------------------------
create or replace function public.write_audit(
  p_action text,
  p_entity_type text,
  p_entity_id text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), p_action, p_entity_type, p_entity_id, p_metadata);
end;
$$;


-- >>>>>>>>>>>>>>>>>>>>>>>>>> 00006_circulation_rpc.sql <<<<<<<<<<<<<<<<<<<<<<<<

-- ============================================================================
-- Migration 00006: circulation RPCs — the transactional heart of the system.
-- Every rule in the RCC borrowing policy is enforced here, server-side,
-- so the UI can never bypass it.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Eligibility check — reused by the UI (pre-flight) and by borrow_book()
-- ---------------------------------------------------------------------------
create or replace function public.evaluate_borrow_eligibility(p_user_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_user       public.users;
  v_profile    public.profiles;
  v_record     public.borrower_records;
  v_limit      smallint;
  v_reasons    jsonb := '[]'::jsonb;
begin
  select * into v_user from public.users where id = p_user_id;
  if not found then
    return jsonb_build_object('eligible', false, 'reasons',
      jsonb_build_array(jsonb_build_object('code', 'unknown_borrower', 'message', 'Borrower account not found.')));
  end if;

  select * into v_profile from public.profiles where user_id = p_user_id;
  select * into v_record  from public.borrower_records where user_id = p_user_id;

  v_limit := coalesce(v_record.borrowing_limit,
                      public.setting_number('borrowing.student.max_books', 3)::smallint);

  if v_user.is_active = false then
    v_reasons := v_reasons || jsonb_build_array(jsonb_build_object(
      'code', 'account_inactive', 'message', 'This library account is inactive.'));
  end if;

  if v_record.status is distinct from null and v_record.status <> 'active' then
    v_reasons := v_reasons || jsonb_build_array(jsonb_build_object(
      'code', 'account_suspended', 'message', 'Account status is ' || v_record.status || '.'));
  end if;

  if coalesce(v_record.is_blocked, false) then
    v_reasons := v_reasons || jsonb_build_array(jsonb_build_object(
      'code', 'unresolved_penalties',
      'message', coalesce(v_record.block_reason, 'Unresolved penalties must be settled first.')));
  end if;

  if coalesce(v_record.active_loans, 0) >= v_limit then
    v_reasons := v_reasons || jsonb_build_array(jsonb_build_object(
      'code', 'loan_limit_reached',
      'message', 'Borrower already holds ' || v_record.active_loans || ' of ' || v_limit || ' allowed books.'));
  end if;

  -- Policy: students must hold an SBTR before borrowing
  if v_profile.borrower_type = 'student'
     and nullif(coalesce(v_profile.sbtr_number, ''), '') is null then
    v_reasons := v_reasons || jsonb_build_array(jsonb_build_object(
      'code', 'sbtr_required',
      'message', 'A Student Book Tracer Record (SBTR) is required before borrowing.'));
  end if;

  return jsonb_build_object(
    'eligible', jsonb_array_length(v_reasons) = 0,
    'reasons', v_reasons,
    'active_loans', coalesce(v_record.active_loans, 0),
    'borrowing_limit', v_limit,
    'outstanding_fines', coalesce(v_record.outstanding_fines, 0)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- borrow_book() — issue a copy to a borrower
-- ---------------------------------------------------------------------------
create or replace function public.borrow_book(
  p_borrower_id uuid,
  p_copy_id     uuid     default null,
  p_barcode     text     default null,
  p_days        smallint default null,
  p_notes       text     default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_copy     public.book_copies;
  v_book     public.books;
  v_elig     jsonb;
  v_due      timestamptz;
  v_tx_id    uuid;
  v_ref      text;
  v_caller   uuid := auth.uid();
begin
  -- Only staff may issue on behalf of another borrower
  if v_caller is distinct from p_borrower_id and not public.is_librarian() then
    return jsonb_build_object('ok', false, 'code', 'forbidden',
                              'message', 'Only librarians may record a borrow for another member.');
  end if;

  select c.* into v_copy
    from public.book_copies c
   where c.id = p_copy_id or (p_barcode is not null and c.barcode = p_barcode);

  if not found then
    return jsonb_build_object('ok', false, 'code', 'copy_not_found',
                              'message', 'No copy matches that barcode.');
  end if;

  select * into v_book from public.books where id = v_copy.book_id;

  if v_book.is_published = false then
    return jsonb_build_object('ok', false, 'code', 'unpublished',
                              'message', 'This title is not in the public catalogue yet.');
  end if;

  if v_copy.is_library_use_only
     or v_book.section in ('reference', 'periodicals') then
    return jsonb_build_object('ok', false, 'code', 'library_use_only',
                              'message', v_book.title || ' is for library use only and cannot be borrowed.');
  end if;

  if v_copy.status <> 'available' then
    return jsonb_build_object('ok', false, 'code', 'copy_unavailable',
                              'message', 'This copy is ' || v_copy.status || '.');
  end if;

  select public.evaluate_borrow_eligibility(p_borrower_id) into v_elig;
  if (v_elig ->> 'eligible')::text <> 'true' then
    return jsonb_build_object('ok', false, 'code', 'not_eligible',
                              'message', 'Borrower is not eligible.', 'details', v_elig -> 'reasons');
  end if;

  v_due   := public.compute_due_date(v_book.section, now(), p_days);
  v_ref   := 'RCC-' || to_char(now(), 'YYMM') || '-' || lpad(nextval('public.borrow_reference_seq')::text, 5, '0');

  insert into public.borrow_transactions
    (reference_no, borrower_id, book_id, copy_id, library_id, librarian_id,
     status, section, date_borrowed, due_date, sbtr_number, source, notes)
  values
    (v_ref, p_borrower_id, v_book.id, v_copy.id, v_book.library_id, v_caller,
     'active', v_book.section, now(), v_due,
     (select sbtr_number from public.profiles where user_id = p_borrower_id),
     case when v_caller = p_borrower_id then 'self-service' else 'librarian' end,
     p_notes)
  returning id into v_tx_id;

  update public.book_copies set status = 'borrowed' where id = v_copy.id;

  -- Promote the head of the reservation queue if this title is queued
  update public.reservations r
     set status = 'ready', ready_at = now(), copy_id = v_copy.id,
         held_until = now() + interval '2 days'
   where r.book_id = v_book.id and r.status = 'waiting'
     and r.borrower_id = p_borrower_id;

  update public.borrower_records
     set last_borrowed_at = now()
   where user_id = p_borrower_id;

  insert into public.notifications (user_id, type, title, body, link, metadata)
  values (
    p_borrower_id, 'due_reminder', 'Book borrowed: ' || v_book.title,
    'Due on ' || to_char(v_due, 'FMMonth FMDD, YYYY') || '. Reference ' || v_ref || '.',
    '/dashboard/borrowings',
    jsonb_build_object('transaction_id', v_tx_id, 'reference_no', v_ref)
  );

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (v_caller, 'book.borrow', 'borrow_transaction', v_tx_id,
          jsonb_build_object('book_id', v_book.id, 'copy_id', v_copy.id,
                             'borrower_id', p_borrower_id, 'due_date', v_due));

  return jsonb_build_object(
    'ok', true, 'transaction_id', v_tx_id, 'reference_no', v_ref,
    'due_date', v_due, 'title', v_book.title, 'copy_id', v_copy.id);
end;
$$;

-- ---------------------------------------------------------------------------
-- return_book() — check a loan back in and assess any fine automatically
-- ---------------------------------------------------------------------------
create or replace function public.return_book(
  p_transaction_id uuid,
  p_condition      public.return_condition default 'good',
  p_remarks        text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tx        public.borrow_transactions;
  v_fine      numeric(10, 2) := 0;
  v_days      integer := 0;
  v_hours     numeric(8, 2) := 0;
  v_copy_next public.copy_status := 'available';
  v_return_id uuid;
begin
  if not public.is_librarian() then
    return jsonb_build_object('ok', false, 'code', 'forbidden',
                              'message', 'Only library staff can check in books.');
  end if;

  select * into v_tx from public.borrow_transactions where id = p_transaction_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found', 'message', 'Transaction not found.');
  end if;
  if v_tx.status in ('returned', 'cancelled') then
    return jsonb_build_object('ok', false, 'code', 'already_returned',
                              'message', 'This loan was already closed.');
  end if;

  if v_tx.due_date < now() then
    if v_tx.section = 'reserve' then
      v_hours := ceil(extract(epoch from (now() - v_tx.due_date)) / 3600.0);
      v_days  := greatest(1, ceil(v_hours / 24.0)::int);
    else
      v_days  := greatest(1, ceil(extract(epoch from (now() - v_tx.due_date)) / 86400.0)::int);
    end if;
    v_fine := public.calculate_fine(v_tx.section, v_tx.due_date, now());
  end if;

  if p_condition = 'damaged' then v_copy_next := 'damaged'; end if;
  if p_condition = 'lost'    then v_copy_next := 'lost';    end if;

  update public.borrow_transactions
     set status = case when p_condition = 'lost' then 'lost'::public.borrow_status
                        when p_condition = 'damaged' then 'damaged'::public.borrow_status
                        else 'returned'::public.borrow_status end,
         date_returned = now(),
         is_overdue = v_days > 0,
         overdue_days = v_days,
         fine_charged = fine_charged + v_fine
   where id = p_transaction_id;

  insert into public.return_transactions
    (borrow_transaction_id, returned_by, date_returned, condition, is_overdue,
     overdue_days, overdue_hours, fine_assessed, remarks)
  values (p_transaction_id, auth.uid(), now(), p_condition, v_days > 0, v_days, v_hours, v_fine, p_remarks)
  returning id into v_return_id;

  update public.book_copies set status = v_copy_next where id = v_tx.copy_id;

  if v_fine > 0 then
    insert into public.fines (borrower_id, borrow_transaction_id, book_id, type, amount,
                              computed_from, computed_to, unit_count, assessed_by)
    values (v_tx.borrower_id, p_transaction_id, v_tx.book_id,
            case when v_tx.section = 'reserve' then 'reserve_hourly'::public.fine_type
                 else 'overdue_daily'::public.fine_type end,
            v_fine, v_tx.due_date, now(),
            case when v_tx.section = 'reserve' then v_hours else v_days::numeric end,
            auth.uid());
  end if;

  if p_condition in ('damaged', 'lost') then
    insert into public.fines (borrower_id, borrow_transaction_id, book_id, type, amount, assessed_by, notes)
    select v_tx.borrower_id, p_transaction_id, v_tx.book_id,
           case when p_condition = 'lost' then 'lost_book'::public.fine_type
                else 'damaged_book'::public.fine_type end,
           case when p_condition = 'lost' then coalesce(cp.acquisition_price, 0) + 150
                else round(coalesce(cp.acquisition_price, 0) * 0.5, 2) end,
           auth.uid(),
           case when p_condition = 'lost' then 'Replacement cost plus processing fee.'
                else 'Repair cost assessment.' end
      from public.book_copies cp where cp.id = v_tx.copy_id;
  end if;

  perform public.refresh_borrower_record(v_tx.borrower_id);
  perform public.refresh_book_counters(v_tx.book_id);

  insert into public.notifications (user_id, type, title, body, link, metadata)
  values (v_tx.borrower_id,
          case when v_fine > 0 then 'fine_assessed'::public.notification_type
               else 'system'::public.notification_type end,
          case when v_fine > 0 then 'Fine assessed on return' else 'Return recorded' end,
          'Transaction closed. ' ||
            case when v_fine > 0 then 'Fine of PHP ' || to_char(v_fine, 'FM0.00') ||
                 ' (' || v_days || ' day(s) overdue).' else 'No fine incurred.' end,
          '/dashboard/penalties',
          jsonb_build_object('transaction_id', p_transaction_id, 'fine', v_fine));

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), 'book.return', 'borrow_transaction', p_transaction_id,
          jsonb_build_object('fine', v_fine, 'condition', p_condition, 'overdue_days', v_days));

  return jsonb_build_object('ok', true, 'fine', v_fine, 'overdue_days', v_days,
                            'overdue_hours', v_hours, 'copy_status', v_copy_next);
end;
$$;

-- ---------------------------------------------------------------------------
-- extend_due_date() — librarian renews a loan
-- ---------------------------------------------------------------------------
create or replace function public.extend_due_date(
  p_transaction_id uuid,
  p_days integer default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tx public.borrow_transactions;
  v_new_due timestamptz;
  v_days integer := coalesce(p_days, public.setting_number('borrowing.student.duration_days', 7)::int);
begin
  if not public.is_librarian() then
    return jsonb_build_object('ok', false, 'code', 'forbidden',
                              'message', 'Only library staff can extend due dates.');
  end if;

  select * into v_tx from public.borrow_transactions where id = p_transaction_id for update;
  if not found or v_tx.status not in ('active', 'overdue') then
    return jsonb_build_object('ok', false, 'code', 'invalid',
                              'message', 'Only open loans can be extended.');
  end if;

  v_new_due := public.compute_due_date(v_tx.section, now(), v_days::smallint);

  update public.borrow_transactions
     set due_date = v_new_due,
         renewals_used = renewals_used + 1,
         is_overdue = false,
         overdue_days = 0,
         status = 'active'
   where id = p_transaction_id;

  insert into public.notifications (user_id, type, title, body, link)
  values (v_tx.borrower_id, 'system', 'Due date extended',
          'Your loan is now due ' || to_char(v_new_due, 'FMMonth FMDD, YYYY') || '.',
          '/dashboard/borrowings');

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), 'loan.extend', 'borrow_transaction', p_transaction_id,
          jsonb_build_object('new_due_date', v_new_due));

  return jsonb_build_object('ok', true, 'due_date', v_new_due);
end;
$$;

-- ---------------------------------------------------------------------------
-- Fines: settle and waive
-- ---------------------------------------------------------------------------
create or replace function public.settle_fine(p_fine_id uuid, p_paid_via text default 'cash')
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_fine public.fines;
begin
  if not public.is_librarian() then
    return jsonb_build_object('ok', false, 'code', 'forbidden', 'message', 'Staff only.');
  end if;
  select * into v_fine from public.fines where id = p_fine_id for update;
  if not found then return jsonb_build_object('ok', false, 'code', 'not_found'); end if;
  if v_fine.status <> 'pending' then
    return jsonb_build_object('ok', false, 'code', 'closed', 'message', 'Fine is already ' || v_fine.status || '.');
  end if;

  update public.fines set status = 'paid', paid_at = now(), paid_via = p_paid_via where id = p_fine_id;
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), 'fine.settle', 'fine', p_fine_id, jsonb_build_object('amount', v_fine.amount));
  return jsonb_build_object('ok', true, 'amount', v_fine.amount);
end;
$$;

create or replace function public.waive_fine(p_fine_id uuid, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_fine public.fines;
begin
  if not public.is_admin() then
    return jsonb_build_object('ok', false, 'code', 'forbidden', 'message', 'Only administrators may waive penalties.');
  end if;
  select * into v_fine from public.fines where id = p_fine_id for update;
  if not found then return jsonb_build_object('ok', false, 'code', 'not_found'); end if;

  update public.fines set status = 'waived', waiver_reason = p_reason, waived_by = auth.uid()
   where id = p_fine_id;
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), 'fine.waive', 'fine', p_fine_id, jsonb_build_object('reason', p_reason));
  return jsonb_build_object('ok', true);
end;
$$;

-- ---------------------------------------------------------------------------
-- Reservations
-- ---------------------------------------------------------------------------
create or replace function public.reserve_book(p_book_id uuid, p_borrower_id uuid default auth.uid())
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_book public.books;
  v_existing uuid;
  v_pos smallint;
  v_res_id uuid;
begin
  if p_borrower_id is null then
    return jsonb_build_object('ok', false, 'code', 'anonymous', 'message', 'Sign in to reserve a book.');
  end if;

  select * into v_book from public.books where id = p_book_id;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found', 'message', 'Title not found.');
  end if;

  if v_book.section in ('reference', 'periodicals') then
    return jsonb_build_object('ok', false, 'code', 'library_use_only',
                              'message', 'Library-use-only titles cannot be reserved.');
  end if;

  select id into v_existing from public.reservations
   where book_id = p_book_id and borrower_id = p_borrower_id
     and status in ('waiting', 'ready')
   order by requested_at desc limit 1;
  if v_existing is not null then
    return jsonb_build_object('ok', false, 'code', 'already_queued',
                              'message', 'You already have an active reservation for this title.',
                              'reservation_id', v_existing);
  end if;

  select count(*)::smallint + 1 into v_pos from public.reservations
   where book_id = p_book_id and status = 'waiting';

  insert into public.reservations (book_id, borrower_id, status, queue_position)
  values (p_book_id, p_borrower_id,
          case when v_book.available_copies > 0 then 'ready'::public.reservation_status
               else 'waiting'::public.reservation_status end,
          v_pos)
  returning id into v_res_id;

  insert into public.notifications (user_id, type, title, body, link)
  values (p_borrower_id, 'reservation_ready', 'Reservation confirmed: ' || v_book.title,
          case when v_book.available_copies > 0
               then 'A copy is available now — present this at the circulation desk.'
               else 'You are number ' || v_pos || ' in the queue. We will notify you when a copy is free.' end,
          '/dashboard/reservations');

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), 'book.reserve', 'reservation', v_res_id,
          jsonb_build_object('book_id', p_book_id, 'position', v_pos));

  return jsonb_build_object('ok', true, 'reservation_id', v_res_id, 'queue_position', v_pos);
end;
$$;

create or replace function public.cancel_reservation(p_reservation_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_res public.reservations;
begin
  select * into v_res from public.reservations where id = p_reservation_id for update;
  if not found then return jsonb_build_object('ok', false, 'code', 'not_found'); end if;
  if v_res.borrower_id <> coalesce(auth.uid(), v_res.borrower_id) and not public.is_librarian() then
    return jsonb_build_object('ok', false, 'code', 'forbidden');
  end if;
  if v_res.status not in ('waiting', 'ready') then
    return jsonb_build_object('ok', false, 'code', 'closed', 'message', 'Reservation is already ' || v_res.status || '.');
  end if;

  update public.reservations
     set status = 'cancelled', cancelled_at = now()
   where id = p_reservation_id;

  with queue as (
    select id, row_number() over (order by requested_at) as n
      from public.reservations
     where book_id = v_res.book_id and status = 'waiting'
  )
  update public.reservations r
     set queue_position = q.n
    from queue q where r.id = q.id;

  return jsonb_build_object('ok', true);
end;
$$;

-- ---------------------------------------------------------------------------
-- Overdue sweep + reminder staging (called by the scheduled notification job)
-- ---------------------------------------------------------------------------
create or replace function public.stage_due_reminders()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sent  integer := 0;
  v_row   record;
  v_days  integer[] := coalesce(
    (select array_agg(x::int) from jsonb_array_elements_text(public.setting('notifications.reminder_days', '[7,3,1]'::jsonb)) x),
    array[7, 3, 1]
  );
begin
  -- Only the scheduler (cron route, Edge Function, admin console sweep) may
  -- stage mail; a signed-in member must never be able to flood the queue.
  perform public.assert_service_runner();

  for v_row in
    select bt.id as tx_id, bt.borrower_id, u.email, u.full_name, b.title, b.accession_number,
           bt.due_date, d.stage
      from public.borrow_transactions bt
      join public.books b on b.id = bt.book_id
      join public.users u on u.id = bt.borrower_id
      cross join unnest(v_days) as d(stage)
     where bt.status in ('active', 'overdue')
       and date_trunc('day', bt.due_date)::date - date_trunc('day', now())::date = d.stage
       and not exists (
             select 1 from public.email_logs e
              where e.dedupe_key = 'reminder:' || d.stage || ':' || bt.id
           )
  loop
    insert into public.email_logs (recipient, user_id, template, subject, body, dedupe_key, borrow_transaction_id)
    values (v_row.email, v_row.borrower_id, 'due_reminder',
            'Return reminder (' || v_row.stage || ' days): ' || v_row.title,
            v_row.full_name || ', please return "' || v_row.title || '" (accession '
              || coalesce(v_row.accession_number, '-') || ') by '
              || to_char(v_row.due_date, 'FMMonth FMDD, YYYY') || '.',
            'reminder:' || v_row.stage || ':' || v_row.tx_id, v_row.tx_id);

    insert into public.notifications (user_id, type, title, body, link)
    values (v_row.borrower_id, 'due_reminder',
            v_row.stage || ' day(s) until "' || v_row.title || '" is due',
            'Due ' || to_char(v_row.due_date, 'FMMonth FMDD, YYYY') || '.', '/dashboard/borrowings');

    v_sent := v_sent + 1;
  end loop;

  -- Overdue notice (once per loan)
  for v_row in
    select bt.id as tx_id, bt.section, bt.borrower_id, u.email, u.full_name, b.title,
           b.accession_number, bt.due_date
      from public.borrow_transactions bt
      join public.books b on b.id = bt.book_id
      join public.users u on u.id = bt.borrower_id
     where bt.status in ('active', 'overdue') and bt.due_date < now()
       and not exists (select 1 from public.email_logs e where e.dedupe_key = 'overdue:' || bt.id)
  loop
    insert into public.email_logs (recipient, user_id, template, subject, body, dedupe_key, borrow_transaction_id)
    values (v_row.email, v_row.borrower_id, 'overdue_notice',
            'OVERDUE: ' || v_row.title || ' — fine accruing',
            v_row.full_name || ', "' || v_row.title || '" (accession '
              || coalesce(v_row.accession_number, '-') || ') was due '
              || to_char(v_row.due_date, 'FMMonth FMDD, YYYY') || '. A fine of PHP '
              || to_char(public.calculate_fine(v_row.section, v_row.due_date, now()), 'FM0.00')
              || ' is accruing.',
            'overdue:' || v_row.tx_id, v_row.tx_id);
    v_sent := v_sent + 1;
  end loop;

  return jsonb_build_object('staged', v_sent, 'overdue_marked', public.mark_overdue_loans());
end;
$$;


-- >>>>>>>>>>>>>>>>>>>>>>>>>> 00007_analytics_rpc.sql <<<<<<<<<<<<<<<<<<<<<<<<

-- ============================================================================
-- Migration 00007: analytics RPCs — dashboard aggregates, trends, OPAC extras
-- ============================================================================

create or replace function public.dashboard_stats()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'total_books',        (select count(*) from public.books where is_published),
    'total_copies',       (select count(*) from public.book_copies),
    'available_copies',   (select count(*) from public.book_copies where status = 'available'),
    'borrowed_copies',    (select count(*) from public.book_copies where status = 'borrowed'),
    'reserved_copies',    (select count(*) from public.book_copies where status = 'reserved'),
    'damaged_copies',     (select count(*) from public.book_copies where status = 'damaged'),
    'lost_copies',        (select count(*) from public.book_copies where status = 'lost'),
    'overdue_loans',      (select count(*) from public.borrow_transactions
                            where status in ('active','overdue') and due_date < now()),
    'active_loans',       (select count(*) from public.borrow_transactions
                            where status in ('active','overdue')),
    'total_borrowers',    (select count(distinct borrower_id) from public.borrow_transactions),
    'registered_users',   (select count(*) from public.users),
    'collected_fines',    (select coalesce(sum(amount), 0) from public.fines where status = 'paid'),
    'outstanding_fines',  (select coalesce(sum(amount), 0) from public.fines where status = 'pending'),
    'open_reservations',  (select count(*) from public.reservations where status in ('waiting','ready')),
    'new_titles_30d',     (select count(*) from public.books where created_at > now() - interval '30 days')
  );
$$;

create or replace function public.borrowing_trends(p_days integer default 30)
returns table (bucket date, loans bigint, returns bigint)
language sql
stable
security definer
set search_path = public
as $$
  with span as (
    select generate_series(
      (current_date - (p_days - 1)::int)::timestamp,
      current_date::timestamp,
      interval '1 day'
    )::date as bucket
  ),
  loan_days as (
    select date_trunc('day', date_borrowed)::date as d, count(*) as c
      from public.borrow_transactions
     where date_borrowed >= current_date - (p_days - 1)::int
     group by 1
  ),
  return_days as (
    select date_trunc('day', date_returned)::date as d, count(*) as c
      from public.borrow_transactions
     where date_returned >= current_date - (p_days - 1)::int
     group by 1
  )
  select s.bucket,
         coalesce(l.c, 0) as loans,
         coalesce(r.c, 0) as returns
    from span s
    left join loan_days l on l.d = s.bucket
    left join return_days r on r.d = s.bucket
   order by s.bucket;
$$;

create or replace function public.popular_books(p_limit integer default 8)
returns table (book_id uuid, title text, author text, loans bigint, library_name text, cover_image_url text)
language sql
stable
security definer
set search_path = public
as $$
  select bt.book_id,
         b.title,
         b.author,
         count(*) as loans,
         l.name as library_name,
         b.cover_image_url
    from public.borrow_transactions bt
    join public.books b on b.id = bt.book_id
    join public.libraries l on l.id = b.library_id
   group by bt.book_id, b.title, b.author, l.name, b.cover_image_url
   order by loans desc
   limit p_limit;
$$;

create or replace function public.popular_categories(p_limit integer default 6)
returns table (category text, loans bigint, titles bigint)
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(c.name, 'Uncategorised') as category,
         count(bt.id) as loans,
         count(distinct b.id) as titles
    from public.borrow_transactions bt
    join public.books b on b.id = bt.book_id
    left join public.book_categories c on c.id = b.category_id
   group by c.name
   order by loans desc
   limit p_limit;
$$;

create or replace function public.branch_usage()
returns table (library_id bigint, library text, titles bigint, copies bigint, active_loans bigint, overdue bigint)
language sql
stable
security definer
set search_path = public
as $$
  select l.id,
         l.name,
         count(distinct b.id) as titles,
         count(cp.id) as copies,
         count(bt.id) filter (where bt.status in ('active','overdue')) as active_loans,
         count(bt.id) filter (where bt.status in ('active','overdue') and bt.due_date < now()) as overdue
    from public.libraries l
    left join public.books b on b.library_id = l.id
    left join public.book_copies cp on cp.book_id = b.id
    left join public.borrow_transactions bt on bt.library_id = l.id
   group by l.id, l.name
   order by l.id;
$$;

create or replace function public.most_active_borrowers(p_limit integer default 8)
returns table (user_id uuid, full_name text, classification text, loans bigint, overdue bigint)
language sql
stable
security definer
set search_path = public
as $$
  select u.id,
         u.full_name,
         coalesce(
           replace(initcap(p.education_level::text), '_', ' '),
           replace(initcap(p.faculty_department::text), '_', ' '),
           replace(initcap(p.college_program::text), '_', ' '),
           'Unclassified'
         ) as classification,
         count(bt.id) as loans,
         count(bt.id) filter (where bt.is_overdue) as overdue
    from public.borrow_transactions bt
    join public.users u on u.id = bt.borrower_id
    left join public.profiles p on p.user_id = u.id
   group by u.id, u.full_name, classification
   order by loans desc, u.full_name
   limit p_limit;
$$;

-- Personal summary for the borrower's own dashboard
create or replace function public.borrower_summary(p_user_id uuid default auth.uid())
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'active_loans',     (select count(*) from public.borrow_transactions
                          where borrower_id = p_user_id and status in ('active','overdue')),
    'due_soon',         (select count(*) from public.borrow_transactions
                          where borrower_id = p_user_id and status in ('active','overdue')
                            and due_date between now() and now() + interval '3 days'),
    'overdue',          (select count(*) from public.borrow_transactions
                          where borrower_id = p_user_id and status in ('active','overdue')
                            and due_date < now()),
    'lifetime_loans',   (select count(*) from public.borrow_transactions where borrower_id = p_user_id),
    'pending_fines',    (select coalesce(sum(amount), 0) from public.fines
                          where borrower_id = p_user_id and status = 'pending'),
    'open_reservations',(select count(*) from public.reservations
                          where borrower_id = p_user_id and status in ('waiting','ready')),
    'unread_notifications',(select count(*) from public.notifications
                          where user_id = p_user_id and not is_read)
  );
$$;

-- Titles added in the last 14 days (landing page + dashboard)
create or replace function public.recently_added(p_limit integer default 8)
returns table (id uuid, title text, author text, cover_image_url text, library_name text,
              section text, created_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select b.id, b.title, b.author, b.cover_image_url, l.name, b.section::text, b.created_at
    from public.books b
    join public.libraries l on l.id = b.library_id
   where b.is_published
   order by b.created_at desc
   limit p_limit;
$$;

-- Recommendation: same category/section as the borrower's history, unread titles
create or replace function public.recommended_books(p_user_id uuid default auth.uid(), p_limit integer default 6)
returns table (id uuid, title text, author text, cover_image_url text, reason text)
language sql
stable
security definer
set search_path = public
as $$
  with taste as (
    select b.category_id, b.section, count(*) as weight
      from public.borrow_transactions bt
      join public.books b on b.id = bt.book_id
     where bt.borrower_id = p_user_id
     group by b.category_id, b.section
  )
  select b.id, b.title, b.author, b.cover_image_url,
         coalesce(c.name, 'Reading together') || ' you may like'
    from public.books b
    left join taste t on t.category_id is not distinct from b.category_id
    left join public.book_categories c on c.id = b.category_id
   where b.is_published and b.available_copies > 0
     and not exists (select 1 from public.borrow_transactions x
                      where x.borrower_id = p_user_id and x.book_id = b.id)
   order by coalesce(t.weight, 0) desc, b.created_at desc
   limit p_limit;
$$;

-- Catalogue search used by OPAC: full-text + filters, single round-trip
create or replace function public.search_books(
  p_query   text default null,
  p_library bigint  default null,
  p_section text    default null,
  p_category bigint default null,
  p_status  text    default null,
  p_only_available boolean default false,
  p_limit   integer default 24,
  p_offset  integer default 0
)
returns table (
  id uuid, title text, author text, call_number text, accession_number text,
  cover_image_url text, section text, status text, library_name text,
  category_name text, total_copies smallint, available_copies smallint,
  publication_year smallint, total_count bigint
)
language sql
stable
security definer
set search_path = public
as $$
  with matched as (
    select v.*,
           count(*) over () as total_count
      from public.book_inventory_view v
     where (p_query is null or btrim(p_query) = ''
            or to_tsvector('simple', v.title || ' ' || v.author || ' ' || coalesce(v.subject, ''))
               @@ plainto_tsquery('simple', btrim(p_query))
            or v.title ilike '%' || btrim(p_query) || '%'
            or v.author ilike '%' || btrim(p_query) || '%'
            or v.call_number ilike '%' || btrim(p_query) || '%'
            or v.accession_number ilike '%' || btrim(p_query) || '%'
            or v.isbn ilike '%' || btrim(p_query) || '%')
       and (p_library is null or v.library_id = p_library)
       and (p_section is null or v.section::text = p_section)
       and (p_category is null or v.category_id = p_category)
       and (p_status is null or v.status::text = p_status)
       and (not p_only_available or v.available_copies > 0)
  )
  select id, title, author, call_number, accession_number, cover_image_url,
         section::text, status::text, library_name, category_name,
         total_copies, available_copies, publication_year, total_count
    from matched
   order by title
   limit p_limit offset p_offset;
$$;


-- >>>>>>>>>>>>>>>>>>>>>>>>>> 00008_row_level_security.sql <<<<<<<<<<<<<<<<<<<<<<<<

-- ============================================================================
-- Migration 00008: Row Level Security
--
-- Design notes
--   * Every policy calls a SECURITY DEFINER helper (has_role / is_librarian /
--     is_admin) so policies never recurse into public.user_roles.
--   * The catalogue is world-readable for OPAC; only published rows leak.
--   * Write paths for members are funnelled through RPCs, which run as the
--     function owner — direct table writes are staff-only.
-- ============================================================================

alter table public.users              enable row level security;
alter table public.roles              enable row level security;
alter table public.user_roles         enable row level security;
alter table public.libraries          enable row level security;
alter table public.book_categories    enable row level security;
alter table public.books              enable row level security;
alter table public.book_copies        enable row level security;
alter table public.book_records       enable row level security;
alter table public.profiles           enable row level security;
alter table public.borrower_records   enable row level security;
alter table public.settings           enable row level security;
alter table public.audit_logs         enable row level security;
alter table public.borrow_transactions   enable row level security;
alter table public.return_transactions   enable row level security;
alter table public.fines               enable row level security;
alter table public.reservations        enable row level security;
alter table public.notifications       enable row level security;
alter table public.email_logs          enable row level security;

-- ---------------------------------------------------------------------------
-- users
-- ---------------------------------------------------------------------------
create policy users_read on public.users
  for select to authenticated
  using (id = auth.uid() or public.is_librarian());

create policy users_update_self on public.users
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

create policy users_staff_write on public.users
  for insert to authenticated
  with check (public.is_admin() or id = auth.uid());

create policy users_admin_write on public.users
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- roles / user_roles
-- ---------------------------------------------------------------------------
create policy roles_read on public.roles for select to authenticated using (true);
create policy roles_admin_write on public.roles for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy user_roles_read on public.user_roles
  for select to authenticated using (user_id = auth.uid() or public.is_librarian());

create policy user_roles_admin_write on public.user_roles
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- Reference data: branches + categories (public read for OPAC)
-- ---------------------------------------------------------------------------
create policy libraries_read on public.libraries for select using (is_active);
create policy libraries_write on public.libraries for all to authenticated
  using (public.is_librarian()) with check (public.is_librarian());

create policy categories_read on public.book_categories for select using (is_active);
create policy categories_write on public.book_categories for all to authenticated
  using (public.is_librarian()) with check (public.is_librarian());

-- ---------------------------------------------------------------------------
-- Catalogue
-- ---------------------------------------------------------------------------
create policy books_read on public.books
  for select using (is_published or public.is_librarian());

create policy books_write on public.books
  for all to authenticated using (public.is_librarian()) with check (public.is_librarian());

create policy copies_read on public.book_copies for select to authenticated using (true);
create policy copies_anon_read on public.book_copies
  for select to anon using (status in ('available', 'borrowed'));

create policy copies_write on public.book_copies
  for all to authenticated using (public.is_librarian()) with check (public.is_librarian());

create policy book_records_read on public.book_records for select using (true);
create policy book_records_write on public.book_records
  for all to authenticated using (public.is_librarian()) with check (public.is_librarian());

-- ---------------------------------------------------------------------------
-- Member profiles & standing
-- ---------------------------------------------------------------------------
create policy profiles_read on public.profiles
  for select to authenticated using (user_id = auth.uid() or public.is_librarian());

create policy profiles_update_self on public.profiles
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy profiles_insert_self on public.profiles
  for insert to authenticated with check (user_id = auth.uid() or public.is_librarian());

create policy profiles_staff_write on public.profiles
  for all to authenticated using (public.is_librarian()) with check (public.is_librarian());

create policy borrower_records_read on public.borrower_records
  for select to authenticated using (user_id = auth.uid() or public.is_librarian());

create policy borrower_records_write on public.borrower_records
  for all to authenticated using (public.is_librarian()) with check (public.is_librarian());

-- ---------------------------------------------------------------------------
-- Circulation
-- ---------------------------------------------------------------------------
create policy loans_read on public.borrow_transactions
  for select to authenticated using (borrower_id = auth.uid() or public.is_librarian());

create policy loans_write on public.borrow_transactions
  for all to authenticated using (public.is_librarian()) with check (public.is_librarian());

create policy returns_read on public.return_transactions
  for select to authenticated
  using (public.is_librarian()
         or exists (select 1 from public.borrow_transactions bt
                     where bt.id = borrow_transaction_id and bt.borrower_id = auth.uid()));

create policy returns_write on public.return_transactions
  for all to authenticated using (public.is_librarian()) with check (public.is_librarian());

create policy fines_read on public.fines
  for select to authenticated using (borrower_id = auth.uid() or public.is_librarian());

create policy fines_write on public.fines
  for all to authenticated using (public.is_librarian()) with check (public.is_librarian());

create policy reservations_read on public.reservations
  for select to authenticated using (borrower_id = auth.uid() or public.is_librarian());

create policy reservations_insert on public.reservations
  for insert to authenticated with check (borrower_id = auth.uid() or public.is_librarian());

create policy reservations_update on public.reservations
  for update to authenticated
  using (borrower_id = auth.uid() and status in ('waiting', 'ready'))
  with check (borrower_id = auth.uid());

create policy reservations_staff_write on public.reservations
  for all to authenticated using (public.is_librarian()) with check (public.is_librarian());

-- ---------------------------------------------------------------------------
-- Notifications / e-mail journal / audit / settings
-- ---------------------------------------------------------------------------
create policy notifications_read on public.notifications
  for select to authenticated using (user_id = auth.uid());

create policy notifications_update on public.notifications
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy notifications_write on public.notifications
  for insert to authenticated with check (public.is_librarian());

create policy email_logs_read on public.email_logs
  for select to authenticated using (public.is_admin() or user_id = auth.uid());

create policy email_logs_write on public.email_logs
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy audit_logs_read on public.audit_logs
  for select to authenticated using (public.is_admin());

create policy audit_logs_write on public.audit_logs
  for insert to authenticated with check (public.is_admin());

create policy settings_read on public.settings for select to authenticated using (true);
create policy settings_write on public.settings
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
grant usage on schema public to anon, authenticated;

grant select on public.libraries, public.book_categories, public.books,
                 public.book_records, public.book_inventory_view to anon;

grant execute on function public.search_books(text, bigint, text, bigint, text, boolean, integer, integer) to anon, authenticated;
grant execute on function public.recently_added(integer) to anon, authenticated;
grant execute on function public.has_role(uuid, public.role_slug) to authenticated;
grant execute on function public.primary_role(uuid) to authenticated;
grant execute on function public.setting(text, jsonb) to authenticated;
grant execute on function public.setting_number(text, numeric) to authenticated;
grant execute on function public.compute_due_date(public.circulation_section, timestamptz, smallint) to authenticated;
grant execute on function public.calculate_fine(public.circulation_section, timestamptz, timestamptz) to authenticated;

grant execute on function
  public.evaluate_borrow_eligibility(uuid),
  public.borrow_book(uuid, uuid, text, smallint, text),
  public.return_book(uuid, public.return_condition, text),
  public.extend_due_date(uuid, integer),
  public.settle_fine(uuid, text),
  public.waive_fine(uuid, text),
  public.reserve_book(uuid, uuid),
  public.cancel_reservation(uuid),
  public.borrower_summary(uuid),
  public.dashboard_stats(),
  public.borrowing_trends(integer),
  public.popular_books(integer),
  public.popular_categories(integer),
  public.branch_usage(),
  public.most_active_borrowers(integer),
  public.mark_overdue_loans(),
  public.stage_due_reminders(),
  public.refresh_borrower_record(uuid),
  public.refresh_book_counters(uuid)
to authenticated;

-- The scheduled reminder job runs with the service key and needs no policy.
revoke all on public.email_logs, public.audit_logs from anon;


-- >>>>>>>>>>>>>>>>>>>>>>>>>> 00010_email_queue_claims.sql <<<<<<<<<<<<<<<<<<<<<<<<

-- ===========================================================================
-- Migration 00010: outbound e-mail queue claims
--
-- `stage_due_reminders()` (00006) journals every 7/3/1-day and overdue notice
-- into public.email_logs with a unique dedupe_key. Something still has to pick
-- those rows up and hand them to the provider — and if two schedulers run (the
-- Vercel cron route and a Supabase Edge Function, or a retried cron tick) they
-- must not both send the same message.
--
-- claim_email_queue() is the single atomic hand-off: FOR UPDATE SKIP LOCKED
-- guarantees one runner per row, and the 'sending' lease means a runner that
-- dies mid-flight cannot strand mail forever.
-- ===========================================================================

-- Lease state between "queued" and the terminal states.
alter type public.email_status add value if not exists 'sending';

alter table public.email_logs
  add column if not exists attempts smallint not null default 0;

-- When the *current* lease was taken. `queued_at` cannot answer that: a backlog
-- row claimed hours after it was staged would look instantly stale to
-- release_stale_email_claims() and be handed to a second runner mid-send.
alter table public.email_logs
  add column if not exists claimed_at timestamptz;

comment on column public.email_logs.attempts is
  'Incremented when a runner claims the row. Capped by claim_email_queue so a '
  'permanently rejected recipient cannot be retried on every cron tick.';

comment on column public.email_logs.claimed_at is
  'Stamped by claim_email_queue() and the clock release_stale_email_claims() '
  'measures the lease against. Rows claimed before this column existed fall back '
  'to queued_at.';

comment on column public.email_logs.status is
  'queued → sending (leased by one runner) → sent | bounced | failed | skipped.';

-- ---------------------------------------------------------------------------
-- Who may drive the queue?
--
-- Supabase grants `execute` on every public function to `anon` and
-- `authenticated` by default, so a narrow `grant to service_role` is not enough:
-- the old broad grant has to be revoked explicitly. The runtime backstop is
-- `assert_service_runner()` (defined with the other RBAC helpers in 00005),
-- which every queue function calls first.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- Atomically lease the oldest queued messages to one runner.
-- ---------------------------------------------------------------------------
create or replace function public.claim_email_queue(
  p_limit        integer default 25,
  p_max_attempts smallint default 5
)
returns setof public.email_logs
language plpgsql
volatile
security definer
set search_path = public
as $$
begin
  perform public.assert_service_runner();

  return query
  with picked as (
    select e.id, e.attempts
      from public.email_logs e
     where e.status = 'queued'
       and e.attempts < p_max_attempts
     order by e.queued_at, e.id
     limit greatest(1, least(p_limit, 100))
     for update of e skip locked
  )
  update public.email_logs as e
     set status     = 'sending',
         attempts   = picked.attempts + 1,
         claimed_at = now()
    from picked
   where e.id = picked.id
  returning e.*;
end;
$$;

comment on function public.claim_email_queue(integer, smallint) is
  'Service-role only lease for the outbound queue. Rows come back in the new '
  'lease state; the runner must PATCH them to sent/failed or they are released '
  'by release_stale_email_claims().';

-- ---------------------------------------------------------------------------
-- Reclaim leases abandoned by a runner that crashed or timed out.
-- Rows that also hit the attempt cap are failed permanently.
-- ---------------------------------------------------------------------------
create or replace function public.release_stale_email_claims(
  p_lease        interval default interval '15 minutes',
  p_max_attempts smallint default 5
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_requeued integer;
  v_expired  integer;
begin
  perform public.assert_service_runner();

  with stale as (
    select id, attempts from public.email_logs
     where status = 'sending'
       and coalesce(claimed_at, queued_at) < now() - p_lease
  )
  update public.email_logs e
     set status = 'queued'
    from stale s
   where e.id = s.id and s.attempts < p_max_attempts;

  get diagnostics v_requeued = row_count;

  update public.email_logs
     set status = 'failed',
         error  = coalesce(error, 'lease expired after ' || attempts || ' attempt(s)')
   where status = 'sending'
     and attempts >= p_max_attempts
     and coalesce(claimed_at, queued_at) < now() - p_lease;

  get diagnostics v_expired = row_count;

  return v_requeued + v_expired;
end;
$$;

comment on function public.release_stale_email_claims(interval, smallint) is
  'Housekeeping for the lease: call before claiming. Returns the rows requeued '
  'plus the rows failed for good.';

-- ---------------------------------------------------------------------------
-- Delivery bookkeeping, so a runner never has to hand-write status strings.
-- ---------------------------------------------------------------------------
create or replace function public.record_email_result(
  p_id         bigint,
  p_status     public.email_status,
  p_provider_id text default null,
  p_error      text default null
)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
begin
  perform public.assert_service_runner();

  update public.email_logs
     set status      = p_status,
         provider_id = coalesce(p_provider_id, provider_id),
         error       = p_error,
         sent_at     = case when p_status = 'sent' then coalesce(sent_at, now()) end
   where id = p_id;
end;
$$;

comment on function public.record_email_result(bigint, public.email_status, text, text) is
  'Terminal write for a claimed row. sent_at is stamped only for the sent state.';

-- ---------------------------------------------------------------------------
-- Grants: the queue is machine-facing, never borrower-facing.
--
-- Supabase's default privileges hand `execute` on every new public function to
-- anon and authenticated, so revoking only from `public` leaves both roles able
-- to drain the queue. Revoke each of them by name, then grant to service_role.
-- ---------------------------------------------------------------------------
revoke all on function public.claim_email_queue(integer, smallint)
  from public, anon, authenticated;
revoke all on function public.release_stale_email_claims(interval, smallint)
  from public, anon, authenticated;
revoke all on function public.record_email_result(bigint, public.email_status, text, text)
  from public, anon, authenticated;
revoke all on function public.assert_service_runner()
  from public, anon, authenticated;

-- The staging job belongs to the scheduler, not to a signed-in member: the desk
-- button in the admin console already runs it through the service-role client.
revoke all on function public.stage_due_reminders() from public, anon, authenticated;

grant execute on function public.claim_email_queue(integer, smallint) to service_role;
grant execute on function public.release_stale_email_claims(interval, smallint) to service_role;
grant execute on function public.record_email_result(bigint, public.email_status, text, text) to service_role;
grant execute on function public.stage_due_reminders() to service_role;

-- Fast lookup for the lease scan and the admin outbox view.
create index if not exists idx_email_logs_claim
  on public.email_logs (status, queued_at, id);


-- >>>>>>>>>>>>>>>>>>>>>>>>>> 00011_rpc_caller_scoping.sql <<<<<<<<<<<<<<<<<<<<<<<<

-- ============================================================================
-- Migration 00011: caller scoping for the two analytics RPCs that read across
-- members.
--
-- Supabase grants EXECUTE on every new public function to `anon` and
-- `authenticated` through default privileges, and a SECURITY DEFINER function
-- runs as its owner — which bypasses Row Level Security. Migration 00008 layers
-- explicit grants on top of that shape, so any signed-in member could reach
-- these two functions with someone else's uuid. borrow_book() and friends refuse
-- non-staff callers inside their bodies; these two had no such check.
-- ============================================================================

-- A member who passes another member's id is quietly answered with their own
-- numbers: there is no useful reason to reject the request outright, and no way
-- to read a stranger's loan, fine or notification counts. Staff keep the
-- ability to look a borrower up.
create or replace function public.borrower_summary(p_user_id uuid default auth.uid())
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_target uuid := coalesce(
    case when p_user_id = auth.uid() or public.is_librarian() then p_user_id end,
    auth.uid()
  );
begin
  return jsonb_build_object(
    'active_loans',        (select count(*) from public.borrow_transactions
                             where borrower_id = v_target and status in ('active','overdue')),
    'due_soon',            (select count(*) from public.borrow_transactions
                             where borrower_id = v_target and status in ('active','overdue')
                               and due_date between now() and now() + interval '3 days'),
    'overdue',             (select count(*) from public.borrow_transactions
                             where borrower_id = v_target and status in ('active','overdue')
                               and due_date < now()),
    'lifetime_loans',      (select count(*) from public.borrow_transactions
                             where borrower_id = v_target),
    'pending_fines',       (select coalesce(sum(amount), 0) from public.fines
                             where borrower_id = v_target and status = 'pending'),
    'open_reservations',   (select count(*) from public.reservations
                             where borrower_id = v_target and status in ('waiting','ready')),
    'unread_notifications',(select count(*) from public.notifications
                             where user_id = v_target and not is_read)
  );
end;
$$;

comment on function public.borrower_summary(uuid) is
  'Loan, fine and notification counts for one member. p_user_id is honoured only '
  'for the caller themselves or for library staff; anyone else is answered with '
  'their own summary. Runs as the function owner, so this check is the guard — '
  'Row Level Security does not apply inside it.';

-- Names plus borrowing counts are a member roster. Empty result for a caller who
-- is not staff, rather than an error, because the widget treats zero rows as
-- "no data" and the analytics page that uses it is already staff-gated in the UI.
create or replace function public.most_active_borrowers(p_limit integer default 8)
returns table (user_id uuid, full_name text, classification text, loans bigint, overdue bigint)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_librarian() then
    return;
  end if;

  return query
  select u.id,
         u.full_name,
         coalesce(
           replace(initcap(p.education_level::text), '_', ' '),
           replace(initcap(p.faculty_department::text), '_', ' '),
           replace(initcap(p.college_program::text), '_', ' '),
           'Unclassified'
         ) as classification,
         count(bt.id) as loans,
         count(bt.id) filter (where bt.is_overdue) as overdue
    from public.borrow_transactions bt
    join public.users u on u.id = bt.borrower_id
    left join public.profiles p on p.user_id = u.id
   group by u.id, u.full_name, classification
   order by loans desc, u.full_name
   limit greatest(1, least(p_limit, 50));
end;
$$;

comment on function public.most_active_borrowers(integer) is
  'Staff-only member roster: returns no rows for a caller who is not a librarian '
  'or administrator.';


-- >>>>>>>>>>>>>>>>>>>>>>>>>> 00012_college_education_levels.sql <<<<<<<<<<<<<<<<<<<<<<<<

-- ===========================================================================
-- Migration 00012: college year levels
--
-- `education_level` stopped at Grade 12 and jumped straight to 'graduate', so
-- a college student had no level to pick — the classification lived entirely in
-- `college_program` and the year of study was nowhere on record. Add the four
-- undergraduate years.
--
-- The values spell out their own label ('college_1st_year' reads as
-- "College 1st Year" through the initcap/replace used by
-- book_borrowing_history_view and most_active_borrowers), the same trick
-- 'grade_11' already relies on.
--
-- Values are appended after 'graduate' — Postgres cannot insert into the middle
-- of an enum — and nothing sorts on this type, so the order is cosmetic. The
-- app lists levels from EDUCATION_LEVELS in src/lib/constants.ts.
-- ===========================================================================

alter type public.education_level add value if not exists 'college_1st_year';
alter type public.education_level add value if not exists 'college_2nd_year';
alter type public.education_level add value if not exists 'college_3rd_year';
alter type public.education_level add value if not exists 'college_4th_year';

comment on type public.education_level is
  'Kinder through Grade 12, the four college years (college_1st_year .. '
  'college_4th_year) and the graduate school. A college or graduate level is '
  'paired with a college_program; a senior high level is paired with a '
  'senior_high_track.';

