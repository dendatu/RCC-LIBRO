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
