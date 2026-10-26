-- ============================================================================
-- Migration 00003: catalogue — categories, books, physical copies, digital cards
-- ============================================================================

-- ---------------------------------------------------------------------------
-- book_categories — topical classification, optionally nested
-- ---------------------------------------------------------------------------
create table public.book_categories (
  id          bigint generated always as identity primary key,
  name        text not null unique,
  slug        text not null unique,
  description text,
  parent_id   bigint references public.book_categories (id) on delete set null,
  sort_order  smallint not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint category_not_self_parent check (parent_id is null or parent_id <> id)
);

create trigger trg_book_categories_updated_at
  before update on public.book_categories
  for each row execute function public.set_updated_at();

insert into public.book_categories (name, slug, description, sort_order) values
  ('General Reference',       'general-reference',  'Dictionaries, encyclopedias, atlases and other library-use-only references.', 1),
  ('Filipiniana',             'filipiniana',        'Works about the Philippines, by Filipino authors.', 2),
  ('Fiction & Literature',    'fiction',            'Novels, short stories and poetry.', 3),
  ('Home Reading',            'home-reading',       'Pleasure reading titles for younger readers.', 4),
  ('Science & Technology',    'science-technology', 'Pure and applied science, IT and engineering.', 5),
  ('Business & Accountancy',  'business',           'Accountancy, management, marketing and entrepreneurship.', 6),
  ('Education',               'education',          'Teaching methods, curriculum and classroom practice.', 7),
  ('Engineering & Architecture','engineering',      'Civil engineering and architecture.', 8),
  ('Hospitality & Tourism',   'hospitality-tourism','Hotel management and tourism studies.', 9),
  ('Health & Nursing',        'health-nursing',     'Nursing, midwifery and allied health.', 10),
  ('Research & Theses',       'research-theses',    'Institutional research output and theses.', 11),
  ('Periodicals',             'periodicals',        'Magazines, newspapers, journals and clippings.', 12);

-- ---------------------------------------------------------------------------
-- books — one row per catalogue title
-- ---------------------------------------------------------------------------
create table public.books (
  id               uuid primary key default gen_random_uuid(),
  accession_number text not null unique,
  call_number      text not null,
  isbn             text,
  title            text not null,
  author           text not null default '',
  subject          text,
  publisher        text,
  publication_year smallint check (publication_year between 1400 and 2200),
  edition          text,
  language         text not null default 'English',
  category_id      bigint references public.book_categories (id) on delete set null,
  library_id       bigint not null references public.libraries (id) on delete restrict,
  section          public.circulation_section not null default 'general',
  description      text,
  cover_image_url  text,
  total_copies     smallint not null default 0,
  available_copies smallint not null default 0,
  status           public.book_status not null default 'processing',
  qr_code_url      text,
  added_by         uuid references public.users (id) on delete set null,
  is_published     boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index idx_books_library      on public.books (library_id);
create index idx_books_category     on public.books (category_id);
create index idx_books_section      on public.books (section);
create index idx_books_status       on public.books (status);
create index idx_books_created_at   on public.books (created_at desc);
create index idx_books_call_number  on public.books (call_number);
create index idx_books_search       on public.books
  using gin (to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(author, '')));

comment on index idx_books_search is
  'Full-text index over title + author powering OPAC search.';

create trigger trg_books_updated_at
  before update on public.books
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- book_copies — individual physical items carrying their own barcode/accession
-- ---------------------------------------------------------------------------
create table public.book_copies (
  id               uuid primary key default gen_random_uuid(),
  book_id          uuid not null references public.books (id) on delete cascade,
  barcode          text not null unique,
  accession_number text unique,
  copy_number      smallint not null default 1,
  status           public.copy_status not null default 'available',
  condition        text not null default 'Good',
  shelf_location   text,
  acquisition_date date,
  acquisition_price numeric(10, 2),
  source           text,
  is_library_use_only boolean not null default false,
  notes            text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint book_copies_copy_number_positive check (copy_number >= 1)
);

create index idx_book_copies_book  on public.book_copies (book_id);
create index idx_book_copies_status on public.book_copies (status);

create trigger trg_book_copies_updated_at
  before update on public.book_copies
  for each row execute function public.set_updated_at();

-- Reference and periodicals items can never leave the library
create or replace function public.enforce_copy_loanability()
returns trigger
language plpgsql
as $$
declare
  v_section public.circulation_section;
begin
  select section into v_section from public.books where id = new.book_id;
  if v_section in ('reference', 'periodicals') then
    new.is_library_use_only = true;
  end if;
  return new;
end;
$$;

create trigger trg_book_copies_loanability
  before insert or update on public.book_copies
  for each row execute function public.enforce_copy_loanability();

-- ---------------------------------------------------------------------------
-- book_records — the digital book card issued per physical copy.
-- Mirrors the traditional pocket card and carries the printable QR payload.
-- ---------------------------------------------------------------------------
create table public.book_records (
  id               uuid primary key default gen_random_uuid(),
  book_id          uuid not null references public.books (id) on delete cascade,
  copy_id          uuid unique references public.book_copies (id) on delete cascade,
  title            text not null,
  author           text not null default '',
  accession_number text,
  call_number      text,
  qr_payload       text not null,
  qr_image_url     text,
  issued_at        timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index idx_book_records_book on public.book_records (book_id);

create trigger trg_book_records_updated_at
  before update on public.book_records
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Keep books.total_copies / available_copies / status in sync with copies
-- ---------------------------------------------------------------------------
create or replace function public.refresh_book_counters(p_book_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.books b
     set total_copies = coalesce(s.total, 0),
         available_copies = coalesce(s.available, 0),
         status = case
           when coalesce(s.total, 0) = 0 then 'processing'::public.book_status
           when coalesce(s.available, 0) > 0 then 'available'::public.book_status
           when coalesce(s.lost, 0) > 0 and coalesce(s.available, 0) = 0 then 'lost'::public.book_status
           when coalesce(s.damaged, 0) > 0 and coalesce(s.available, 0) = 0 then 'damaged'::public.book_status
           when coalesce(s.reserved, 0) > 0 then 'reserved'::public.book_status
           else 'borrowed'::public.book_status
         end
    from (
      select count(*) as total,
             count(*) filter (where status = 'available') as available,
             count(*) filter (where status = 'lost') as lost,
             count(*) filter (where status = 'damaged') as damaged,
             count(*) filter (where status = 'reserved') as reserved
        from public.book_copies
       where book_id = p_book_id
    ) s
   where b.id = p_book_id;
$$;

create or replace function public.on_copy_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    perform public.refresh_book_counters(new.book_id);
  elsif tg_op = 'DELETE' then
    perform public.refresh_book_counters(old.book_id);
  else
    perform public.refresh_book_counters(old.book_id);
    if new.book_id is distinct from old.book_id or new.status is distinct from old.status then
      perform public.refresh_book_counters(new.book_id);
    end if;
  end if;
  return null;
end;
$$;

create trigger trg_book_copies_counters
  after insert or update or delete on public.book_copies
  for each row execute function public.on_copy_change();

-- ---------------------------------------------------------------------------
-- Auto-issue a digital book card whenever a physical copy is registered
-- ---------------------------------------------------------------------------
create or replace function public.on_copy_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_book public.books;
begin
  select * into v_book from public.books where id = new.book_id;
  insert into public.book_records (book_id, copy_id, title, author, accession_number, call_number, qr_payload)
  values (
    new.book_id, new.id, v_book.title, v_book.author,
    coalesce(new.accession_number, v_book.accession_number),
    v_book.call_number,
    'rcc-libro://copy/' || new.barcode
  )
  on conflict (copy_id) do nothing;
  return new;
end;
$$;

create trigger trg_book_records_issue
  after insert on public.book_copies
  for each row execute function public.on_copy_created();

-- Keep card metadata aligned if the catalogue record is edited
create or replace function public.on_book_updated()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.book_records
     set title = new.title,
         author = new.author,
         call_number = new.call_number
   where book_id = new.id;
  return new;
end;
$$;

create trigger trg_book_records_sync
  after update of title, author, call_number on public.books
  for each row execute function public.on_book_updated();

-- ---------------------------------------------------------------------------
-- Convenience view used by OPAC and dashboards
-- ---------------------------------------------------------------------------
-- security_invoker makes the view evaluate under the calling user's Row Security
-- policies. A plain view runs as its owner and would hand every row to any
-- authenticated caller, so this flag is load-bearing, not cosmetic.
drop view if exists public.book_inventory_view;
create view public.book_inventory_view
with (security_invoker = true)
as
select
  b.id,
  b.accession_number,
  b.call_number,
  b.isbn,
  b.title,
  b.author,
  b.subject,
  b.publisher,
  b.publication_year,
  b.edition,
  b.language,
  b.description,
  b.cover_image_url,
  b.qr_code_url,
  b.status,
  b.section,
  b.total_copies,
  b.available_copies,
  b.created_at,
  b.updated_at,
  l.id   as library_id,
  l.code as library_code,
  l.name as library_name,
  c.id   as category_id,
  c.name as category_name,
  c.slug as category_slug
from public.books b
join public.libraries l on l.id = b.library_id
left join public.book_categories c on c.id = b.category_id
where b.is_published;

comment on view public.book_inventory_view is
  'Published catalogue joined with branch and category — the read model used by search and lists.';
