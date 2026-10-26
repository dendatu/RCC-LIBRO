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
