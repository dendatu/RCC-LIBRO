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
