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
