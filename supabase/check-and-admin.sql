-- ===========================================================================
-- RCC LIBRO — post-install check + Google OAuth administrator grant
--
-- Run AFTER supabase/schema.sql (and optionally supabase/seed-demo.sql).
-- Part 1 is read-only. Part 2 changes nothing until you edit the e-mail.
-- ===========================================================================


-- ---------------------------------------------------------------------------
-- PART 1 · Verify the install (read-only)
-- ---------------------------------------------------------------------------
select
  (select count(*) from information_schema.tables
    where table_schema = 'public' and table_type = 'BASE TABLE')          as tables,
  (select count(*) from pg_catalog.pg_type t join pg_catalog.pg_namespace n
      on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typtype = 'e')                        as enums,
  (select count(*) from pg_indexes where schemaname = 'public')            as indexes,
  (select count(*) from pg_trigger tg join pg_class c on c.oid = tg.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and not tg.tgisinternal)                     as triggers,
  (select count(*) from pg_views where schemaname = 'public')              as views,
  (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in
      ('borrow_book','return_book','extend_due_date','calculate_fine',
       'compute_due_date','evaluate_borrow_eligibility','mark_overdue_loans',
       'stage_due_reminders','search_books','handle_new_user',
       'claim_email_queue','release_stale_email_claims','record_email_result',
       'assert_service_runner'))                                             as core_functions;

-- The outbound queue is machine-facing. anon/authenticated must be false for
-- every row here; a true means Supabase's default EXECUTE grant was left open
-- and any signed-in borrower could drain or forge the e-mail queue.
select p.proname as service_only_function,
       has_function_privilege('anon',          p.oid, 'execute') as anon_can_run,
       has_function_privilege('authenticated', p.oid, 'execute') as member_can_run,
       has_function_privilege('service_role',  p.oid, 'execute') as service_can_run
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public'
   and p.proname in ('claim_email_queue','release_stale_email_claims',
                     'record_email_result','stage_due_reminders')
 order by 1;

-- Every public table must have RLS on; 0 rows means the schema is complete.
select c.relname as table_without_rls
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity = false
 order by 1;

-- Policy count per table (expected: 46 across 19 tables).
select schemaname, tablename, count(*) as policies
  from pg_policies where schemaname = 'public'
 group by 1, 2 order by 3 desc, 1;

-- Views must run as the caller, otherwise they bypass RLS and leak every
-- member's SBTR and borrowing history to any signed-in borrower.
select relname as view,
       case when exists (
              select 1 from unnest(coalesce(c.reloptions, '{}')) as o
               where o ~ '^security_invoker=(true|t|1|on)$'
            ) then 'caller-invoked (safe)'
            else 'OWNER-INVOKED — leaks across users'
          end as invoker
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'public' and c.relkind = 'v'
 order by 1;

-- Auth triggers that provision accounts for every sign-up provider.
select tgname as auth_trigger, p.proname as function
  from pg_trigger tg
  join pg_class c on c.oid = tg.tgrelid
  join pg_namespace n on n.oid = c.relnamespace
  join pg_proc p on p.oid = tg.tgfoid
 where n.nspname = 'auth' and c.relname = 'users' and not tg.tgisinternal
 order by 1;

-- Provisioning smoke test: each auth user must own exactly one account row,
-- one borrower_records row and at least one role.
select u.id, u.email,
       (select count(*) from public.users p where p.id = u.id)          as app_user,
       (select count(*) from public.profiles f where f.user_id = u.id)  as profile,
       (select count(*) from public.borrower_records b where b.user_id = u.id) as borrower_row,
       (select count(*) from public.user_roles r where r.user_id = u.id) as roles
  from auth.users u order by u.created_at;


-- ---------------------------------------------------------------------------
-- PART 2 · Make a Google-signed account an administrator
--
-- handle_new_user() grants 'borrower' to everyone. To promote the account you
-- just used to sign in with Google: sign in once (so the row exists), replace
-- the e-mail below, and run the statement. Unchanged, it matches nothing.
-- ---------------------------------------------------------------------------
insert into public.user_roles (user_id, role_slug)
select u.id, 'admin'::public.role_slug
  from auth.users u
 where u.email = 'REPLACE-WITH-YOUR-GOOGLE-EMAIL'
on conflict (user_id, role_slug) do nothing;

-- Confirm which identities actually came from Google and are now provisioned.
select u.email,
       u.email_confirmed_at is not null                as email_verified,
       coalesce(u.raw_user_meta_data ->> 'full_name',
                u.raw_user_meta_data ->> 'name')       as profile_name,
       (u.raw_app_meta_data ->> 'providers')           as providers,
       (select string_agg(r.role_slug::text, ', ' order by r.role_slug)
          from public.user_roles r where r.user_id = u.id) as roles
  from auth.users u
 order by u.created_at;

-- Staff accounts need the librarian role the same way:
--   insert into public.user_roles (user_id, role_slug)
--   select id, 'librarian' from auth.users where email = 'librarian@example.edu'
--   on conflict (user_id, role_slug) do nothing;
