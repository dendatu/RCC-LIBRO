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
