-- ===========================================================================
-- RCC LIBRO — schedule the due-reminders Edge Function
--
-- Supabase Edge Functions have no cron of their own, so the database wakes the
-- function up with pg_cron + pg_net. Run this in the SQL Editor AFTER:
--   1. supabase/schema.sql and (optionally) supabase/seed-demo.sql
--   2. supabase functions deploy due-reminders --no-verify-jwt
--   3. supabase secrets set SUPABASE_SERVICE_ROLE_KEY=... CRON_SECRET=...
--                      RESEND_API_KEY=... RESEND_FROM_ADDRESS=...
--
-- Edit the two values in the do-block below, then run the whole file.
-- ===========================================================================

create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

do $$
declare
  -- https://<project-ref>.functions.supabase.co/due-reminders
  v_url    text := 'https://REPLACE-WITH-YOUR-PROJECT-REF.functions.supabase.co/due-reminders';
  -- Must match the CRON_SECRET function secret.
  v_secret text := 'REPLACE-WITH-YOUR-CRON-SECRET';
begin
  if v_url like '%REPLACE-WITH%' or v_secret like '%REPLACE-WITH%' then
    raise exception 'edit v_url and v_secret in this do-block before running it';
  end if;

  -- Re-runnable: drop any previous schedule with the same name.
  if exists (select 1 from cron.job where jobname = 'rcc-libro-due-reminders') then
    perform cron.unschedule('rcc-libro-due-reminders');
  end if;

  -- The function does the staging itself, so this call only has to fire it.
  -- 23:00 UTC = 07:00 Asia/Manila, before the library opens.
  perform cron.schedule(
    'rcc-libro-due-reminders',
    '0 23 * * *',
    format(
      $q$select net.http_post(
         url := %L,
         headers := jsonb_build_object(
           'content-type', 'application/json',
           'authorization', %s
         ),
         body := '{}'::jsonb
       );$q$,
      v_url, quote_literal('Bearer ' || v_secret))
  );
end
$$;

-- What is scheduled, and did the calls succeed?
select jobid, jobname, schedule, active from cron.job order by jobid;

select jobid,
       status,
       return_message,
       start_time at time zone 'UTC'  as started_utc,
       round((end_time - start_time)::numeric * 1000) as ms
  from cron.job_run_details
 order by start_time desc
 limit 10;

-- Queued vs. delivered, straight from the journal the function writes.
select status, count(*) as messages, max(queued_at) as newest
  from public.email_logs
 group by status
 order by status;

-- Every borrower should be able to see their own notices in-app.
select u.email,
       count(e.id)                                          as emails,
       count(e.id) filter (where e.status = 'sent')         as sent,
       count(n.id)                                          as in_app_notices
  from public.users u
  left join public.email_logs e on e.user_id = u.id
  left join public.notifications n on n.user_id = u.id
 group by u.email
 order by emails desc, u.email
 limit 15;

-- ---------------------------------------------------------------------------
-- Keeping the secret out of the schedule
--
-- cron.job stores the command text, so the bearer token above is readable by
-- anyone with database access to cron.job. To avoid that, put the whole call
-- behind a Vault secret:
--
--   select vault.create_secret('https://...:REPLACE@.../due-reminders',
--     'rcc_libro_reminder_endpoint');
--
--   -- then schedule instead:
--   select net.http_post(
--     url  := (select decrypted_string from vault.decrypted_secrets
--               where name = 'rcc_libro_reminder_endpoint' limit 1),
--     ...);
--
-- or leave reminders on the Vercel cron route (/api/cron/reminders), which
-- reads CRON_SECRET from environment variables rather than from the database.
-- ---------------------------------------------------------------------------
