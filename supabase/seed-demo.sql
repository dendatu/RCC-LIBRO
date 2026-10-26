-- ===========================================================================
-- RCC LIBRO — Consolidated demo data (optional)
-- Republic Central Colleges, Angeles City Campus
--
-- Paste this whole file into the Supabase SQL Editor; it runs as one script in
-- the order listed below.
--
-- Source migrations:
--   00009_seed_demo.sql
--
-- OPTIONAL. Creates demo logins with the shared password documented inside the file.
-- Do NOT run this against a live library database. Remove it before going public.
-- ===========================================================================


-- >>>>>>>>>>>>>>>>>>>>>>>>>> 00009_seed_demo.sql <<<<<<<<<<<<<<<<<<<<<<<<

-- ============================================================================
-- Migration 00009: dictionary + demo seed data
--
-- Creates the RCC classification dictionary and a working sample catalogue so
-- the application is usable immediately after migration.
--
-- DEMO PASSWORD FOR EVERY ACCOUNT:  RccLibrary#2026
-- Remove or rotate these rows before going live (see README → "Demo data").
--
-- This file does NOT create sign-in credentials. GoTrue owns `auth.users`, and a
-- row inserted with plain SQL is unreadable to it: signing in answers "Invalid
-- login credentials" or "Database error querying schema". Create the seven
-- logins first with `node scripts/create-demo-accounts.mjs`, in the Dashboard
-- (Authentication → Users), or by signing up through the app; the preflight
-- below then tells you exactly which ones are missing. Re-runnable: an account
-- that already exists keeps its own password and only gets its role and profile
-- fields refreshed.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Preflight: refuse to half-seed. Nothing above this point writes, so an abort
-- here leaves the project exactly as it was.
-- ---------------------------------------------------------------------------
do $$
declare
  v_missing text;
begin
  select string_agg(d.email, ', ' order by d.ord)
    into v_missing
    from (values
      (1, 'admin@rcc.edu.ph'),     (2, 'librarian@rcc.edu.ph'), (3, 'circ@rcc.edu.ph'),
      (4, 'student@rcc.edu.ph'),   (5, 'grade6@rcc.edu.ph'),    (6, 'shs@rcc.edu.ph'),
      (7, 'grad@rcc.edu.ph')
    ) as d(ord, email)
   where not exists (select 1 from auth.users u where u.email = d.email);

  if v_missing is not null then
    raise exception 'no sign-in account exists for: %', v_missing
      using hint = 'Run: node scripts/create-demo-accounts.mjs   (or create these e-mails in Dashboard -> Authentication -> Users), then paste this file again.';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Classification dictionary: readable mirror of the enum values, used by the
-- UI to render labelled pickers grouped by school level.
-- ---------------------------------------------------------------------------
create table if not exists public.classifications (
  id         bigint generated always as identity primary key,
  kind       text not null,
  value      text not null,
  label      text not null,
  group_name text,
  sort_order smallint not null default 0,
  unique (kind, value)
);

insert into public.classifications (kind, value, label, group_name, sort_order) values
  ('education_level', 'kinder',   'Kinder',   'Elementary',   1),
  ('education_level', 'grade_1',  'Grade 1',  'Elementary',   2),
  ('education_level', 'grade_2',  'Grade 2',  'Elementary',   3),
  ('education_level', 'grade_3',  'Grade 3',  'Elementary',   4),
  ('education_level', 'grade_4',  'Grade 4',  'Elementary',   5),
  ('education_level', 'grade_5',  'Grade 5',  'Elementary',   6),
  ('education_level', 'grade_6',  'Grade 6',  'Elementary',   7),
  ('education_level', 'grade_7',  'Grade 7',  'Junior High',  8),
  ('education_level', 'grade_8',  'Grade 8',  'Junior High',  9),
  ('education_level', 'grade_9',  'Grade 9',  'Junior High', 10),
  ('education_level', 'grade_10', 'Grade 10', 'Junior High', 11),
  ('education_level', 'grade_11', 'Grade 11', 'Senior High', 12),
  ('education_level', 'grade_12', 'Grade 12', 'Senior High', 13),
  ('education_level', 'college_1st_year', '1st Year', 'College', 14),
  ('education_level', 'college_2nd_year', '2nd Year', 'College', 15),
  ('education_level', 'college_3rd_year', '3rd Year', 'College', 16),
  ('education_level', 'college_4th_year', '4th Year', 'College', 17),
  ('education_level', 'graduate', 'Graduate School', 'Graduate', 18),
  ('senior_high_track', 'pba',  'Accountancy and Business',            'Track', 1),
  ('senior_high_track', 'ssh',  'Science, Technology and Society',      'Track', 2),
  ('senior_high_track', 'peat', 'Engineering, Applied and Technology',  'Track', 3),
  ('senior_high_track', 'phs',  'Health and Service Management',        'Track', 4),
  ('college_program', 'abel',              'ABEL — Bachelor of Elementary Education',              'College', 1),
  ('college_program', 'bsa',               'BSA — Bachelor of Science in Accountancy',             'College', 2),
  ('college_program', 'bsce',              'BSCE — Bachelor of Science in Civil Engineering',      'College', 3),
  ('college_program', 'bsit',              'BSIT — Bachelor of Science in Information Technology', 'College', 4),
  ('college_program', 'bsba',              'BSBA — Bachelor of Science in Business Administration','College', 5),
  ('college_program', 'bshm',              'BSHM — Bachelor of Science in Hospitality Management', 'College', 6),
  ('college_program', 'bstm',              'BSTM — Bachelor of Science in Tourism Management',     'College', 7),
  ('college_program', 'beed',              'BEED — Bachelor of Elementary Education',              'College', 8),
  ('college_program', 'bsed_english',      'BSED English — Bachelor of Secondary Education',       'College', 9),
  ('college_program', 'bsed_mathematics',  'BSED Mathematics — Bachelor of Secondary Education',   'College', 10),
  ('college_program', 'bsed_filipino',     'BSED Filipino — Bachelor of Secondary Education',      'College', 11),
  ('college_program', 'graduate_school',   'Graduate School',                                      'Graduate', 12),
  ('faculty_department', 'elementary',      'Elementary',      'Department', 1),
  ('faculty_department', 'high_school',     'High School',     'Department', 2),
  ('faculty_department', 'college',         'College',         'Department', 3),
  ('faculty_department', 'graduate_school', 'Graduate School', 'Department', 4)
on conflict (kind, value) do nothing;

do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'classifications' and policyname = 'classifications_read') then
    alter table public.classifications enable row level security;
    create policy classifications_read on public.classifications for select using (true);
    create policy classifications_write on public.classifications
      for all to authenticated using (public.is_admin()) with check (public.is_admin());
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Demo accounts: enrich the seven logins created through GoTrue
-- ---------------------------------------------------------------------------
do $$
declare
  v_spec    record;
  v_user_id uuid;
begin
  for v_spec in
    select * from (values
      ('admin@rcc.edu.ph',     'Atty. Maria Elena Santos', 'admin',     null::text, null::text, null::text, null::text),
      ('librarian@rcc.edu.ph', 'Josefina Ramirez',         'librarian', 'faculty',  null::text, 'college',  null::text),
      ('circ@rcc.edu.ph',      'Marco Dela Cruz',          'librarian', 'faculty',  null::text, 'high_school', null::text),
      ('student@rcc.edu.ph',   'Andrei Reyes',             'borrower',  'student',  null::text, null::text, 'bsit'),
      ('grade6@rcc.edu.ph',    'Camille Torres',           'borrower',  'student',  'grade_6',  null::text, null::text),
      ('shs@rcc.edu.ph',       'Nathan Villanueva',        'borrower',  'student',  'grade_11', null::text, null::text),
      ('grad@rcc.edu.ph',      'Dr. Liza Mendoza',         'borrower',  'faculty',  null::text, 'graduate_school', null::text)
    ) as t(email, full_name, role, borrower_type, education_level, department, program)
  loop
    v_user_id := null;
    select id into v_user_id from auth.users where email = v_spec.email;

    -- handle_new_user() provisions these rows on a real sign-up, and the local
    -- harness inserts its stand-in auth rows before that trigger exists, so
    -- create the same rows here. Everything conflicts with what the trigger
    -- already made, which keeps a hosted project unchanged.
    insert into public.users (id, full_name, email)
    values (v_user_id, v_spec.full_name, v_spec.email)
    on conflict (id) do update set full_name = excluded.full_name;

    insert into public.profiles (user_id)
    values (v_user_id)
    on conflict (user_id) do nothing;

    insert into public.borrower_records (user_id)
    values (v_user_id)
    on conflict (user_id) do nothing;

    insert into public.user_roles (user_id, role_slug)
    values (v_user_id, v_spec.role::public.role_slug)
    on conflict do nothing;

    update public.profiles
       set borrower_type      = v_spec.borrower_type::public.borrower_type,
           education_level    = nullif(v_spec.education_level, '')::public.education_level,
           faculty_department = nullif(v_spec.department, '')::public.faculty_department,
           college_program    = nullif(v_spec.program, '')::public.college_program,
           senior_high_track  = case when v_spec.education_level in ('grade_11', 'grade_12')
                                      then 'ssh'::public.senior_high_track end,
           sbtr_number        = case when v_spec.borrower_type = 'student'
                                      then 'SBTR-' || upper(substr(md5(v_spec.email), 1, 8)) end,
           card_number        = 'RCC-' || upper(substr(md5(v_spec.email), 9, 6))
     where user_id = v_user_id;

    update public.users
       set contact_number = '+63 9' || lpad((abs(hashtext(v_spec.email)) % 100000000)::text, 8, '0')
     where id = v_user_id;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Sample catalogue: every branch and every library section
-- ---------------------------------------------------------------------------
insert into public.books
  (accession_number, call_number, isbn, title, author, subject, publisher, publication_year,
   category_id, library_id, section, description, cover_image_url, added_by, is_published)
select v.acc, v.call_no, v.isbn, v.title, v.author, v.subject, v.publisher, v.year::smallint,
       c.id, l.id, v.section::public.circulation_section, v.blurb,
       null,
       (select id from public.users where email = 'librarian@rcc.edu.ph'), true
  from (values
    ('ACC-2024-0001','025.04 COE','9780061150089','The Alchemist','Paulo Coelho','Fiction','HarperOne',2014,'fiction','CGS','general','A shepherd journeys toward his personal legend.'),
    ('ACC-2024-0002','899.010 RIZ','9789715524169','Noli Me Tangere','Jose Rizal','Filipiniana','National Book Development Board',1998,'filipiniana','CGS','filipiniana','The novel that stirred Philippine nationalism.'),
    ('ACC-2024-0003','004.18 PRE','9780135957059','Software Engineering: A Practitioner''s Approach','Roger S. Pressman','Information Technology','McGraw-Hill',2020,'science-technology','CGS','general','Core reference for the BSIT curriculum.'),
    ('ACC-2024-0004','657 WEY','9781118970055','Accounting Principles','Weygandt, Kimmel and Kieso','Accountancy','Wiley',2018,'business','CGS','general','Foundational financial accounting for BSA.'),
    ('ACC-2024-0005','372 SLA','9780134806631','Educational Psychology','Robert E. Slavin','Education','Pearson',2019,'education','CGS','general','Learner-centred teaching theory for BEED and BSED.'),
    ('ACC-2024-0006','371.39 MAG','9789717600100','Bright Moments for Little Hearts','Rosa Magsaysay','Home Reading','RCC Press',2012,'home-reading','EL','home_reading','Values education reader for Grade 3.'),
    ('ACC-2024-0007','398.2 ESP','9789717600000','Bahaghari at ang Buwan','Lina Espina','Home Reading','Adarna House',2015,'home-reading','EL','home_reading','Picture book for Kinder readers.'),
    ('ACC-2024-0008','J 808 JOA','9781502300000','Shrine of Memories and Other Stories','Nick Joaquin','Fiction','Random House',2011,'fiction','HS','fiction','Selected stories for senior high readers.'),
    ('ACC-2024-0009','423 HOR','9780194303396','Oxford Advanced Learner''s Dictionary','A. S. Hornby','Reference','Oxford University Press',2020,'general-reference','HS','reference','Library use only.'),
    ('ACC-2024-0010','030 ENC','9781593392925','World Book Encyclopedia, Volume 12','Various Authors','Reference','World Book',2017,'general-reference','CGS','reference','Library use only.'),
    ('ACC-2024-0011','910.3 NAM','9780008315642','Atlas of the Philippine Islands','NAMRIA','Reference','National Mapping and Resource Information Authority',2019,'general-reference','HS','reference','Library use only.'),
    ('ACC-2024-0012','P 070 INQ','1234567890','Philippine Daily Inquirer — Bound Archive','Various Authors','Periodicals','Inquirer Group',2025,'periodicals','HS','periodicals','Newspaper archive: library use only.'),
    ('ACC-2024-0013','R 658.15 GAR','9781259288251','Managerial Accounting','Garrison and Noreen','Business','McGraw-Hill',2021,'business','CGS','reserve','Course reserve title — one-hour in-library use.'),
    ('ACC-2024-0014','R 519.5 BLU','9781259341276','Elementary Statistics: A Step by Step Approach','Allan G. Bluman','Mathematics','McGraw-Hill',2018,'education','HS','reserve','Course reserve title — one-hour in-library use.'),
    ('ACC-2024-0015','620.1 HIB','9781119320827','Engineering Mechanics: Statics','R. C. Hibbeler','Engineering','Wiley',2017,'engineering','CGS','newly_acquired','Core text for BSCE.'),
    ('ACC-2024-0016','647.95 ALT','9781633610000','Hospitality Industry Operations','Stephen Altin','Hospitality','Wiley',2019,'hospitality-tourism','CGS','newly_acquired','Core text for BSHM and BSTM.'),
    ('ACC-2024-0017','610.73 KI','9780323511571','Fundamentals of Nursing','Kozier and Erb','Health','Elsevier',2022,'health-nursing','CGS','general','Nursing foundations.'),
    ('ACC-2024-0018','THESIS 2025 IT','n/a','Automated Library Circulation Using QR Codes','RCC BSIT Research Group','Research','Republic Central Colleges',2025,'research-theses','CGS','research_output','Institutional research output.'),
    ('ACC-2024-0019','895.9 TOL','9789718606877','Ibong Adarna','Unknown','Filipiniana','RCC Press',2009,'filipiniana','EL','home_reading','Epikong Pilipino para sa Grade 7.'),
    ('ACC-2024-0020','153 KAH','9780393609394','Thinking, Fast and Slow','Daniel Kahneman','Psychology','W. W. Norton',2011,'science-technology','CGS','general','Graduate school reading.')
  ) as v(acc, call_no, isbn, title, author, subject, publisher, year, cat_slug, lib_code, section, blurb)
  join public.book_categories c on c.slug = v.cat_slug
  join public.libraries l on l.code = v.lib_code
on conflict (accession_number) do nothing;

-- Physical copies: 3 per circulating title, 1 per in-house-only title
insert into public.book_copies (book_id, barcode, accession_number, copy_number, shelf_location, condition, acquisition_date, acquisition_price)
select b.id,
       'BC' || lpad((row_number() over (order by b.accession_number, g.i))::text, 6, '0'),
       b.accession_number || '-' || lpad(g.i::text, 2, '0'),
       g.i::smallint,
       initcap(b.section::text) || ' Stack, Shelf ' || (1 + (g.i % 8)),
       'Good',
       (b.created_at)::date,
       (180 + (abs(hashtext(b.title)) % 900))::numeric(10, 2)
  from public.books b
  cross join generate_series(
    1,
    case when b.section in ('reference', 'periodicals', 'reserve', 'research_output') then 1 else 3 end
  ) as g(i)
 where not exists (select 1 from public.book_copies c where c.book_id = b.id);

-- ---------------------------------------------------------------------------
-- Sample circulation history so charts and SBTR have data from day one
-- ---------------------------------------------------------------------------
do $$
declare
  v_borrower uuid;
  v_librarian uuid;
  v_copy record;
  v_row record;
  v_due timestamptz;
  v_ref text;
  i integer := 0;
begin
  -- Re-running this file must not re-issue the sample history: the historical
  -- references below are deterministic (RCC-H0001…), so a second pass would
  -- collide with the first instead of being a no-op.
  if exists (select 1 from public.borrow_transactions
              where reference_no like 'RCC-H%'
                 or reference_no like '%-O90001'
                 or reference_no like '%-R00001') then
    raise notice 'sample circulation history is already present — leaving it alone';
    return;
  end if;

  select id into v_librarian from public.users where email = 'librarian@rcc.edu.ph';

  -- historical (already returned) loans spread over the last 45 days
  for v_copy in
    select c.id as copy_id, c.book_id, b.section, b.library_id
      from public.book_copies c
      join public.books b on b.id = c.book_id
     where b.section not in ('reference', 'periodicals')
       and c.status = 'available'
     order by random()
     limit 26
  loop
    i := i + 1;
    select id into v_borrower from public.users
      where email = (array['student@rcc.edu.ph','grade6@rcc.edu.ph','shs@rcc.edu.ph','grad@rcc.edu.ph'])[1 + (i % 4)];

    insert into public.borrow_transactions
      (reference_no, borrower_id, book_id, copy_id, library_id, librarian_id, status, section,
       date_borrowed, due_date, date_returned, sbtr_number, is_overdue, overdue_days, fine_charged)
    values (
      'RCC-H' || lpad(i::text, 4, '0'),
      v_borrower, v_copy.book_id, v_copy.copy_id, v_copy.library_id, v_librarian,
      'returned', v_copy.section,
      now() - ((30 + (i % 15)) || ' days')::interval,
      now() - ((23 + (i % 15)) || ' days')::interval,
      now() - ((i % 12) || ' days')::interval,
      (select sbtr_number from public.profiles where user_id = v_borrower),
      (i % 7 = 0),
      case when i % 7 = 0 then (i % 5) + 1 else 0 end,
      case when i % 7 = 0 then ((i % 5) + 1)::numeric * public.setting_number('borrowing.fine.per_day', 1) else 0 end
    );
  end loop;

  -- three open loans for the demo student (policy limit is 3)
  for v_copy in
    select c.id as copy_id, c.book_id, b.section, b.library_id
      from public.book_copies c
      join public.books b on b.id = c.book_id
     where c.status = 'available' and b.section = 'general'
     order by b.title
     limit 2
  loop
    select id into v_borrower from public.users where email = 'student@rcc.edu.ph';
    v_due := public.compute_due_date(v_copy.section);
    v_ref := 'RCC-' || to_char(now(), 'YYMM') || '-O' || nextval('public.borrow_reference_seq');

    insert into public.borrow_transactions
      (reference_no, borrower_id, book_id, copy_id, library_id, librarian_id, status, section,
       date_borrowed, due_date, sbtr_number)
    values (v_ref, v_borrower, v_copy.book_id, v_copy.copy_id, v_copy.library_id, v_librarian,
            'active', v_copy.section, now() - interval '9 days', v_due,
            (select sbtr_number from public.profiles where user_id = v_borrower));

    update public.book_copies set status = 'borrowed' where id = v_copy.copy_id;
  end loop;

  -- one overdue loan for the senior high student
  select c.id as copy_id, c.book_id, b.section, b.library_id
    into v_copy
    from public.book_copies c
    join public.books b on b.id = c.book_id
   where c.status = 'available' and b.section = 'fiction'
   order by b.title limit 1;

  if found then
    select id into v_borrower from public.users where email = 'shs@rcc.edu.ph';
    insert into public.borrow_transactions
      (reference_no, borrower_id, book_id, copy_id, library_id, librarian_id, status, section,
       date_borrowed, due_date, is_overdue, overdue_days, sbtr_number)
    values ('RCC-' || to_char(now(), 'YYMM') || '-O90001', v_borrower, v_copy.book_id, v_copy.copy_id,
            v_copy.library_id, v_librarian, 'overdue', v_copy.section,
            now() - interval '12 days', now() - interval '5 days', true, 5,
            (select sbtr_number from public.profiles where user_id = v_borrower));
    update public.book_copies set status = 'borrowed' where id = v_copy.copy_id;
    insert into public.fines (borrower_id, borrow_transaction_id, book_id, type, amount, unit_count)
    select v_borrower, bt.id, bt.book_id, 'overdue_daily',
           5 * public.setting_number('borrowing.fine.per_day', 1), 5
      from public.borrow_transactions bt
     where bt.reference_no = 'RCC-' || to_char(now(), 'YYMM') || '-O90001';
  end if;

  -- a reserve-book loan (one-hour rule)
  select c.id as copy_id, c.book_id, b.section, b.library_id
    into v_copy
    from public.book_copies c
    join public.books b on b.id = c.book_id
   where c.status = 'available' and b.section = 'reserve'
   order by b.title limit 1;

  if found then
    select id into v_borrower from public.users where email = 'student@rcc.edu.ph';
    insert into public.borrow_transactions
      (reference_no, borrower_id, book_id, copy_id, library_id, librarian_id, status, section,
       date_borrowed, due_date, sbtr_number)
    values ('RCC-' || to_char(now(), 'YYMM') || '-R00001', v_borrower, v_copy.book_id, v_copy.copy_id,
            v_copy.library_id, v_librarian, 'active', 'reserve',
            now(), now() + interval '1 hour',
            (select sbtr_number from public.profiles where user_id = v_borrower));
    update public.book_copies set status = 'borrowed' where id = v_copy.copy_id;
  end if;

  for v_row in select distinct borrower_id from public.borrow_transactions loop
    perform public.refresh_borrower_record(v_row.borrower_id);
  end loop;

  for v_row in select distinct book_id from public.borrow_transactions loop
    perform public.refresh_book_counters(v_row.book_id);
  end loop;
end $$;

-- Demo reservation queue entry
insert into public.reservations (book_id, borrower_id, status, queue_position)
select b.id, u.id, 'waiting', 1
  from public.books b, public.users u
 where b.accession_number = 'ACC-2024-0001' and u.email = 'grad@rcc.edu.ph'
   and not exists (select 1 from public.reservations r where r.book_id = b.id and r.borrower_id = u.id);

insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
select id, 'system.seed', 'application', null, jsonb_build_object('migration', '00009_seed_demo')
  from public.users where email = 'admin@rcc.edu.ph';

