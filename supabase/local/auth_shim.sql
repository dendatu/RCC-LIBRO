-- Local test harness shim — NOT applied to Supabase hosted projects.
-- It reproduces just enough of Supabase's managed `auth` schema and Postgres
-- roles so that migrations 00001-00009 can be validated against plain
-- PostgreSQL (see scripts/validate-sql.sh). On a real project these objects are
-- owned by GoTrue and already exist.

-- Postgres has no CREATE ROLE .. IF NOT EXISTS, so the shim stays re-runnable
-- against a database whose public schema was dropped and rebuilt.
do $$
begin
  if not exists (select from pg_roles where rolname = 'anon') then
    create role anon nologin noinherit;
  end if;
  if not exists (select from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin noinherit;
  end if;
  if not exists (select from pg_roles where rolname = 'service_role') then
    create role service_role nologin noinherit bypassrls;
  end if;
end
$$;

-- Re-creating it is needed when the harness drops the public schema for a reload.
create schema if not exists public;

grant usage on schema public to anon, authenticated, service_role;

-- Supabase grants broad table privileges to its API roles and relies on Row
-- Level Security for the actual row gating; the shim mirrors that so the
-- migrations are exercised under the same privilege shape as a hosted project.
alter default privileges in schema public grant all on tables    to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;

create schema if not exists auth;
grant usage on schema auth to anon, authenticated, service_role;

create table if not exists auth.users (
  instance_id           uuid,
  id                    uuid primary key default gen_random_uuid(),
  aud                   text,
  role                  text,
  email                 text unique,
  encrypted_password    text,
  email_confirmed_at    timestamptz,
  phone_confirmed_at    timestamptz,
  -- Generated the same way Supabase defines it, so a script that tries to write
  -- it fails here exactly as it fails on a hosted project.
  confirmed_at          timestamptz generated always as (greatest(email_confirmed_at, phone_confirmed_at)) stored,
  last_sign_in_at       timestamptz,
  raw_app_meta_data     jsonb,
  raw_user_meta_data    jsonb,
  created_at            timestamptz default now(),
  updated_at            timestamptz default now(),
  phone                 text,
  deleted_at            timestamptz,
  is_sso_user           boolean default false,
  is_anonymous          boolean default false,
  ban_reason            text
);

create schema if not exists extensions;

-- The demo accounts below need crypt()/gen_salt(); on a hosted project pgcrypto
-- already lives in `extensions`, and 00001 creates it the same way.
create extension if not exists pgcrypto with schema extensions;

-- Stand-in for the accounts GoTrue owns on a hosted project. A real project gets
-- them from `node scripts/create-demo-accounts.mjs` (or Dashboard ->
-- Authentication -> Users, or a Google sign-in), because 00009 refuses to invent
-- auth.users rows itself. They are inserted here rather than through
-- handle_new_user(): this file runs before the migrations create that trigger,
-- and 00009 provisions the public.users / profiles rows itself.
insert into auth.users (instance_id, aud, role, email, encrypted_password,
                        email_confirmed_at, raw_app_meta_data, raw_user_meta_data)
select '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated',
       u.email, extensions.crypt('RccLibrary#2026', extensions.gen_salt('bf')), now(),
       '{"provider":"email","providers":["email"]}'::jsonb,
       jsonb_build_object('full_name', u.full_name)
  from (values
    ('admin@rcc.edu.ph',     'Atty. Maria Elena Santos'),
    ('librarian@rcc.edu.ph', 'Josefina Ramirez'),
    ('circ@rcc.edu.ph',      'Marco Dela Cruz'),
    ('student@rcc.edu.ph',   'Andrei Reyes'),
    ('grade6@rcc.edu.ph',    'Camille Torres'),
    ('shs@rcc.edu.ph',       'Nathan Villanueva'),
    ('grad@rcc.edu.ph',      'Dr. Liza Mendoza')
  ) as u(email, full_name)
 on conflict (email) do nothing;
create or replace function auth.uid() returns uuid
language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

create or replace function auth.role() returns text
language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), 'authenticated')
$$;

create or replace function auth.jwt() returns jsonb
language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb
$$;

-- The seed migration writes auth.users rows directly, as GoTrue would.
grant all on all tables in schema auth to anon, authenticated, service_role;
grant usage, create on schema auth to service_role;
