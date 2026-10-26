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
