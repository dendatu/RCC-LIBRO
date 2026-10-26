-- ============================================================================
-- Diagnose Registration Issues
-- ============================================================================
-- This script checks if the tables and policies are set up correctly
-- for the handle_new_user trigger to work
-- ============================================================================

-- Check if required tables exist
select
  'users' as table_name,
  (select count(*) from information_schema.tables where table_schema = 'public' and table_name = 'users') as exists
union all
select 'profiles', (select count(*) from information_schema.tables where table_schema = 'public' and table_name = 'profiles')
union all
select 'borrower_records', (select count(*) from information_schema.tables where table_schema = 'public' and table_name = 'borrower_records')
union all
select 'notifications', (select count(*) from information_schema.tables where table_schema = 'public' and table_name = 'notifications')
union all
select 'user_roles', (select count(*) from information_schema.tables where table_schema = 'public' and table_name = 'user_roles');

-- Check RLS policies on users table
select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
from pg_policies
where tablename = 'users'
order by policyname;

-- Check if handle_new_user trigger exists
select
  tgname as trigger_name,
  proname as function_name
from pg_trigger tg
join pg_proc p on p.oid = tg.tgfoid
join pg_class c on c.oid = tg.tgrelid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'auth' and c.relname = 'users' and not tg.tgisinternal
order by tgname;

-- Check recent auth.users entries
select
  id,
  email,
  email_confirmed_at,
  created_at,
  raw_user_meta_data
from auth.users
order by created_at desc
limit 5;
