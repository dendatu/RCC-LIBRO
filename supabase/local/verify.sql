-- ============================================================================
-- RCC LIBRO — local schema harness assertion pass (NOT applied to Supabase).
-- Run by scripts/validate-sql.sh after the shim, the 9 migrations and the demo
-- seed are applied to plain PostgreSQL. \echo lines are progress only; the
-- assertions that actually guard the build are the RAISE EXCEPTION statements.
-- ============================================================================

\set ON_ERROR_STOP on

-- Due dates are anchored to local closing time, so the harness pins the
-- Philippine timezone to keep its assertions deterministic on any host.
set timezone = 'Asia/Manila';

\echo '-- 1. seeded objects'
select
  (select count(*) from public.libraries)           as libraries,
  (select count(*) from public.roles)               as roles,
  (select count(*) from public.settings)            as settings,
  (select count(*) from public.book_categories)     as categories,
  (select count(*) from public.users)               as users,
  (select count(*) from public.books)               as books,
  (select count(*) from public.book_copies)         as copies,
  (select count(*) from public.book_records)        as book_records,
  (select count(*) from public.borrow_transactions) as loans,
  (select count(*) from public.fines)               as fines,
  (select count(*) from public.reservations)        as reservations,
  (select count(*) from public.notifications)       as notifications;

\echo '-- 2. read models'
select count(*) as inventory_rows from public.book_inventory_view;
select count(*) as sbtr_rows      from public.sbtr_view;
select count(*) as history_rows   from public.book_borrowing_history_view;

\echo '-- 3. policy functions'
select public.compute_due_date('general')           is not null as general_is_dated,
       public.calculate_fine('general', now() - interval '3 days') as fine_3_days,
       public.calculate_fine('reserve', now() - interval '2 hours') as fine_reserve_2_hours,
       public.compute_due_date('reserve', '2026-01-05 09:00+08')  as reserve_morning,
       public.compute_due_date('reserve', '2026-01-05 17:30+08')  as reserve_after_hours,
       public.compute_due_date('reference', '2026-01-05 09:00+08') as reference_due_at;

\echo '-- 4. analytics rpcs'
select jsonb_typeof(public.dashboard_stats())                   as stats_shape,
       (select count(*) from public.borrowing_trends(30))        as trend_points,
       (select count(*) from public.popular_books(5))            as popular_books,
       (select count(*) from public.popular_categories(5))       as popular_categories,
       (select count(*) from public.branch_usage())              as branch_rows,
       (select count(*) from public.most_active_borrowers(5))    as top_borrowers,
       (select count(*) from public.recently_added(8))           as recent_rows,
       (select count(*) from public.search_books('philippine'))  as search_hits,
       (select max(total_count) from public.search_books(null))   as search_total;

\echo '-- 5. hard assertions (fail the harness when they do not hold)'
do $$
declare
  v_value numeric;
begin
  if (select count(*) from public.branch_usage()) <> 3 then
    raise exception 'expected exactly 3 library branches in branch_usage()';
  end if;
  if public.calculate_fine('general', now() - interval '3 days') <> 3 then
    raise exception 'overdue fine must be PHP 3 for a 3-day-late general loan, got %',
      public.calculate_fine('general', now() - interval '3 days');
  end if;
  if public.calculate_fine('general', now() + interval '1 day') <> 0 then
    raise exception 'a loan that is not yet due must carry no fine';
  end if;
  if public.calculate_fine('general', now() - interval '1 hour') <> 1 then
    raise exception 'any part of a day overdue must round up to a full PHP 1';
  end if;

  -- Due-date rules: reserve is a one-hour in-library hold before 16:00 and a
  -- next-school-day loan afterwards; reference stock is due at the desk.
  if public.compute_due_date('reserve', '2026-01-05 09:00+08')
     <> '2026-01-05 10:00+08'::timestamptz then
    raise exception 'a morning reserve loan must be due one hour later, got %',
      public.compute_due_date('reserve', '2026-01-05 09:00+08');
  end if;
  if public.compute_due_date('reserve', '2026-01-05 17:30+08')
     <> '2026-01-06 23:59+08'::timestamptz then
    raise exception 'a reserve loan taken after the take-home hour must be due the next day, got %',
      public.compute_due_date('reserve', '2026-01-05 17:30+08');
  end if;
  if public.compute_due_date('reference', '2026-01-05 09:00+08')
     <> '2026-01-05 09:00+08'::timestamptz then
    raise exception 'reference stock must be due immediately at the desk';
  end if;
  if public.compute_due_date('general', '2026-01-05 09:00+08')
     <> '2026-01-12 23:59+08'::timestamptz then
    raise exception 'a general loan must be due 7 days later at 23:59, got %',
      public.compute_due_date('general', '2026-01-05 09:00+08');
  end if;
  if public.compute_due_date('general', '2026-01-05 09:00+08'::timestamptz, 3::smallint)
     <> '2026-01-08 23:59+08'::timestamptz then
    raise exception 'the days override must win over the seeded loan period';
  end if;

  if (select count(*) from public.book_copies c
        join public.books b on b.id = c.book_id
       where b.section in ('reference','periodicals') and c.is_library_use_only = false) > 0 then
    raise exception 'enforce_copy_loanability() let in-house stock become loanable';
  end if;
  if exists (select 1 from public.book_records r
               join public.book_copies c on c.id = r.copy_id
              where r.qr_payload <> 'rcc-libro://copy/' || c.barcode) then
    raise exception 'a digital book card carries the wrong QR payload';
  end if;
  if (select count(*) from public.book_copies c
        where not exists (select 1 from public.book_records r where r.copy_id = c.id)) > 0 then
    raise exception 'every physical copy must carry a digital book card';
  end if;
  if (select count(*) from public.search_books('philippine')) < 1 then
    raise exception 'OPAC full-text search found nothing for a term that exists in the seed';
  end if;
  if (select count(*) from public.book_inventory_view) <> (select count(*) from public.books) then
    raise exception 'book_inventory_view must expose one row per title';
  end if;
  v_value := public.setting_number('borrowing.student.max_books', 0);
  if v_value <> 3 then
    raise exception 'setting_number() must read the seeded loan limit, got %', v_value;
  end if;
  raise notice 'static assertions passed';
end
$$;

-- ============================================================================
-- 6. circulation end-to-end as a signed-in librarian: RLS + JWT claims are
--    simulated by the auth shim, so this exercises the same security path the
--    application uses. Every step that must succeed raises on failure.
-- ============================================================================
\echo '-- 6. circulation scenario'
-- Fixture identities are captured while still the schema owner (RLS bypassed),
-- parked in custom GUCs, then replayed as the signed-in librarian.
-- The seed gives every student an SBTR, so one account is deliberately stripped
-- of its tracer record here to prove the SBTR gate fires.
create temp table harness_fixture as
with borrower_students as (
  select u.id, p.sbtr_number, br.is_blocked, br.active_loans,
         row_number() over (order by u.id) as rn
    from public.users u
    join public.profiles p on p.user_id = u.id
    join public.borrower_records br on br.user_id = u.id
   where p.borrower_type = 'student' and p.sbtr_number is not null
)
select
  (select u.id from public.users u
     join public.user_roles ur on ur.user_id = u.id
    where ur.role_slug = 'librarian' limit 1)                       as librarian_id,
  (select id from borrower_students
    where is_blocked = false and active_loans = 0 order by rn limit 1)          as student_id,
  (select id from borrower_students
    where id <> (select id from borrower_students
                  where is_blocked = false and active_loans = 0 order by rn limit 1)
    order by rn limit 1)                                            as nosbtr_id;

update public.profiles
   set sbtr_number = null
 where user_id = (select nosbtr_id from harness_fixture);

select set_config('harness.librarian', (select librarian_id::text from harness_fixture), false) as librarian_fixture,
       set_config('harness.nosbtr',    (select nosbtr_id::text   from harness_fixture), false) as nosbtr_fixture,
       set_config('harness.student',   (select student_id::text  from harness_fixture), false) as student_fixture;

set role authenticated;

do $$
declare
  v_librarian uuid := current_setting('harness.librarian')::uuid;
  v_clean     uuid := current_setting('harness.nosbtr')::uuid;   -- student, no SBTR
  v_student   uuid := current_setting('harness.student')::uuid;  -- eligible student
  v_barcode   text;
  v_inhouse   text;
  v_book      uuid;
  v_res       jsonb;
  v_tx        uuid;
  v_open      integer;
  v_limit     integer;
  v_fines     numeric;
begin
  if v_librarian is null then
    raise exception 'seed has no librarian account';
  end if;
  perform set_config('request.jwt.claim.sub', v_librarian::text, false);

  if public.primary_role(auth.uid()) <> 'librarian' then
    raise exception 'primary_role() does not see the simulated JWT subject';
  end if;
  if not public.is_librarian() then
    raise exception 'is_librarian() denied the simulated librarian under RLS';
  end if;

  -- SBTR gate: students without a tracer record cannot borrow.
  if v_clean is null then
    raise exception 'seed has no SBTR-less student to test the gate';
  end if;
  v_res := public.evaluate_borrow_eligibility(v_clean);
  if v_res ->> 'eligible' <> 'false'
     or not exists (select 1 from jsonb_array_elements(v_res -> 'reasons') r
                     where r ->> 'code' = 'sbtr_required') then
    raise exception 'SBTR gate did not refuse an SBTR-less student: %', v_res;
  end if;

  -- The eligible borrower came from the fixture above (SBTR present, unblocked,
  -- no open loans).
  if v_student is null then
    raise exception 'seed has no eligible borrower with a free loan slot';
  end if;
  if (public.evaluate_borrow_eligibility(v_student) ->> 'eligible') <> 'true' then
    raise exception 'eligible student % was refused: %', v_student,
      public.evaluate_borrow_eligibility(v_student);
  end if;

  select c.barcode into v_barcode
    from public.book_copies c
    join public.books b on b.id = c.book_id
   where b.section not in ('reference','periodicals')
     and c.status = 'available'
     and not exists (select 1 from public.reservations rs
                      where rs.copy_id = c.id and rs.status in ('ready','waiting'))
   limit 1;
  if v_barcode is null then
    raise exception 'no available loanable copy to issue';
  end if;

  v_res := public.borrow_book(p_borrower_id => v_student, p_barcode => v_barcode, p_days => 7::smallint, p_notes => 'harness issue');
  if v_res ->> 'ok' <> 'true' then
    raise exception 'borrow_book refused a valid loan: %', v_res;
  end if;
  v_tx := (v_res ->> 'transaction_id')::uuid;
  if v_res ->> 'reference_no' not like 'RCC-%' then
    raise exception 'unexpected reference number %', v_res ->> 'reference_no';
  end if;

  -- Counters must move together (denormalised copy, book and standing).
  if not exists (select 1 from public.book_copies c where c.id = (v_res ->> 'copy_id')::uuid
                  and c.status = 'borrowed') then
    raise exception 'copy did not flip to borrowed';
  end if;
  if (select br.active_loans from public.borrower_records br where br.user_id = v_student) <> 1 then
    raise exception 'borrower_record.active_loans did not refresh';
  end if;

  -- Overdue state: backdate the due date, roll the flag, then check in.
  update public.borrow_transactions
     set due_date = now() - interval '5 days'
   where id = v_tx;
  if public.mark_overdue_loans() < 1 then
    raise exception 'mark_overdue_loans() did not flag the backdated loan';
  end if;

  v_res := public.return_book(v_tx, 'good', 'harness return');
  if v_res ->> 'ok' <> 'true' then
    raise exception 'return_book refused the loan: %', v_res;
  end if;
  v_fines := public.calculate_fine('general', now() - interval '5 days');
  if (select overdue_days from public.return_transactions where borrow_transaction_id = v_tx) <> 5 then
    raise exception 'return_transactions did not record 5 overdue days';
  end if;
  if not exists (select 1 from public.fines f
                  where f.borrow_transaction_id = v_tx and f.status = 'pending'
                    and f.amount = v_fines) then
    raise exception 'no pending fine of % was assessed for the overdue loan', v_fines;
  end if;

  -- Library-use-only stock must be refused outright.
  select c.barcode into v_inhouse
    from public.book_copies c
    join public.books b on b.id = c.book_id
   where b.section in ('reference','periodicals')
   limit 1;
  v_res := public.borrow_book(p_borrower_id => v_student, p_barcode => v_inhouse, p_notes => 'harness in-house');
  if v_res ->> 'code' <> 'library_use_only' then
    raise exception 'in-house copy was not refused as library_use_only: %', v_res;
  end if;

  -- Loan-limit ceiling: fill every slot, then expect the policy to refuse more.
  select coalesce(borrowing_limit, 3) into v_limit
    from public.borrower_records where user_id = v_student;
  select count(*) into v_open from public.borrow_transactions
   where borrower_id = v_student and status in ('active','overdue');
  while v_open < v_limit
  loop
    select c.barcode into v_barcode
      from public.book_copies c
      join public.books b on b.id = c.book_id
     where b.section not in ('reference','periodicals') and c.status = 'available'
       and not exists (select 1 from public.reservations rs
                        where rs.copy_id = c.id and rs.status in ('ready','waiting'))
     limit 1;
    exit when v_barcode is null;
    v_res := public.borrow_book(p_borrower_id => v_student, p_barcode => v_barcode, p_days => 7::smallint, p_notes => 'harness fill');
    exit when v_res ->> 'ok' <> 'true';
    v_open := v_open + 1;
  end loop;

  if v_open < v_limit then
    raise exception 'could not fill the % loan slots of borrower % (stopped at %)',
      v_limit, v_student, v_open;
  end if;

  v_res := public.evaluate_borrow_eligibility(v_student);
  if v_res ->> 'eligible' <> 'false'
     or not exists (select 1 from jsonb_array_elements(v_res -> 'reasons') r
                     where r ->> 'code' = 'loan_limit_reached') then
    raise exception 'the loan limit of % did not block the next borrow: %', v_limit, v_res;
  end if;

  select c.barcode into v_barcode
    from public.book_copies c
    join public.books b on b.id = c.book_id
   where b.section not in ('reference','periodicals') and c.status = 'available'
   limit 1;
  if v_barcode is not null then
    v_res := public.borrow_book(p_borrower_id => v_student, p_barcode => v_barcode, p_days => 7::smallint, p_notes => 'harness over-limit');
    if v_res ->> 'code' <> 'not_eligible' then
      raise exception 'borrow_book issued a loan beyond the limit of %: %', v_limit, v_res;
    end if;
  end if;

  -- Reservations: a hold on a loanable title is accepted for a queued member.
  select b.id into v_book
    from public.books b
    join public.book_copies c on c.book_id = b.id
   where b.section not in ('reference','periodicals')
   limit 1;
  v_res := public.reserve_book(v_book, v_clean);
  if v_res ->> 'ok' <> 'true' then
    raise exception 'reserve_book refused a valid hold: %', v_res;
  end if;

  -- Hand the tracer record back so the seed stays recognisable afterwards.
  update public.profiles
     set sbtr_number = 'SBTR-' || upper(substr(md5(v_clean::text), 1, 8))
   where user_id = v_clean and sbtr_number is null;

  raise notice 'circulation scenario passed (overdue fine = % PHP)', v_fines;
end
$$;

-- ============================================================================
-- 7. reminders: staging is idempotent thanks to email_logs.dedupe_key.
-- ============================================================================
\echo '-- 7. reminder staging'
reset role;
-- Staging is a scheduler job: the librarian fixture's session claim from section 6
-- would trip assert_service_runner(), so drop it the way a service-role call would.
select set_config('request.jwt.claim.sub', '', false);
select public.stage_due_reminders() as first_run;
select public.stage_due_reminders() as second_run;
select jsonb_typeof(public.stage_due_reminders()) as staged_shape;
select count(*) as null_dedupe_keys from public.email_logs where dedupe_key is null;

\echo '-- 8. row level security isolation (borrower sees only their own rows)'
reset role;
-- Every member also holds the borrower role, so pick one with no staff role:
-- that is the account whose visibility must be restricted by RLS.
select set_config('harness.borrower',
       (select u.id::text from public.users u
          join public.user_roles ur on ur.user_id = u.id
         where ur.role_slug = 'borrower'
           and not exists (select 1 from public.user_roles s
                            where s.user_id = u.id and s.role_slug in ('librarian','admin'))
         limit 1), false) as borrower_fixture;

set role authenticated;
select set_config('request.jwt.claim.sub', current_setting('harness.borrower'), false);

do $$
declare
  v_me   uuid := auth.uid();
  v_loans integer;
  v_users integer;
begin
  if v_me is null then
    raise exception 'no borrower account in the seed to test RLS with';
  end if;
  select count(*) into v_loans from public.borrow_transactions;
  if exists (select 1 from public.borrow_transactions where borrower_id <> v_me) then
    raise exception 'RLS leak: a borrower can read another member''s loans';
  end if;
  select count(*) into v_users from public.users;
  if v_users <> 1 then
    raise exception 'RLS leak: a borrower sees % user rows instead of only their own', v_users;
  end if;
  if exists (select 1 from public.audit_logs)
     or exists (select 1 from public.email_logs) then
    raise exception 'RLS leak: a borrower can read audit or e-mail journals';
  end if;

  -- Views run as their owner unless declared security_invoker, so these are the
  -- easiest tables to leak through by accident.
  if (select count(*) from public.sbtr_view) <> (select count(*) from public.borrow_transactions) then
    raise exception 'RLS leak: sbtr_view exposes rows beyond the caller''s own loans (% vs %)',
      (select count(*) from public.sbtr_view),
      (select count(*) from public.borrow_transactions);
  end if;
  if (select count(*) from public.book_borrowing_history_view)
     > (select count(*) from public.borrow_transactions) then
    raise exception 'RLS leak: book_borrowing_history_view is wider than the caller''s loans';
  end if;
  if (select count(*) from public.book_inventory_view)
     <> (select count(*) from public.books where is_published) then
    raise exception 'book_inventory_view no longer matches the published catalogue';
  end if;

  raise notice 'RLS isolation passed for %', v_me;
end
$$;

reset role;

\echo '-- 9. outbound queue lease (claim / record / release)'
do $$
declare
  v_row    public.email_logs;
  v_claimed integer;
begin
  -- The queue runner carries no subject claim; section 8 left a borrower's
  -- claim on this session, so clear it before testing the service path.
  perform set_config('request.jwt.claim.sub', '', false);

  -- The lease state must exist in the enum or the Edge Function cannot claim.
  if not exists (select 1 from pg_enum e join pg_type t on t.oid = e.enumtypid
                  where t.typname = 'email_status' and e.enumlabel = 'sending') then
    raise exception 'email_status is missing the sending lease label';
  end if;

  -- Take one queued row and check it came back leased, not merely read.
  select * into v_row from public.claim_email_queue(1);
  if v_row.id is null then
    raise exception 'claim_email_queue leased nothing although the queue has staged reminders';
  end if;
  if v_row.status <> 'sending' or v_row.attempts <> 1 then
    raise exception 'claimed row should be leased: got status=% attempts=%',
      v_row.status, v_row.attempts;
  end if;

  -- A leased row must never be handed to a second runner.
  select count(*) into v_claimed from public.claim_email_queue(100) c where c.id = v_row.id;
  if v_claimed <> 0 then
    raise exception 'double lease: claim_email_queue returned an already-leased row';
  end if;

  -- Terminal write stamps sent_at exactly once.
  perform public.record_email_result(v_row.id, 'sent', 'resev_abc123');
  if (select status from public.email_logs where id = v_row.id) <> 'sent' then
    raise exception 'record_email_result did not settle the row';
  end if;
  if (select sent_at from public.email_logs where id = v_row.id) is null then
    raise exception 'a sent row must carry sent_at';
  end if;
  if (select provider_id from public.email_logs where id = v_row.id) is null then
    raise exception 'record_email_result dropped the provider id';
  end if;

  -- A runner that died mid-flight must have its lease returned.
  update public.email_logs
     set status = 'sending', attempts = 1, queued_at = now() - interval '1 hour'
   where id = v_row.id;
  if public.release_stale_email_claims(interval '15 minutes') < 1 then
    raise exception 'release_stale_email_claims ignored an expired lease';
  end if;
  if (select status from public.email_logs where id = v_row.id) <> 'queued' then
    raise exception 'an expired lease under the attempt cap should return to queued';
  end if;

  -- Past the attempt cap the same row fails permanently instead of looping.
  update public.email_logs
     set status = 'sending', attempts = 5, queued_at = now() - interval '1 hour'
   where id = v_row.id;
  perform public.release_stale_email_claims(interval '15 minutes');
  if (select status from public.email_logs where id = v_row.id) <> 'failed' then
    raise exception 'a row past the attempt cap should be failed, not requeued';
  end if;

  -- Exhausted rows must not be claimable again.
  select count(*) into v_claimed from public.claim_email_queue(100) c where c.id = v_row.id;
  if v_claimed <> 0 then
    raise exception 'claim_email_queue handed out a row that exhausted its attempts';
  end if;

  -- Nothing about the lease may duplicate a notice for one loan stage.
  if exists (select 1 from public.email_logs group by dedupe_key having count(*) > 1) then
    raise exception 'dedupe_key is no longer unique across the queue';
  end if;

  -- Supabase grants execute on new public functions to anon and authenticated by
  -- default, so the queue must be revoked from both by name.
  if has_function_privilege('anon', 'public.claim_email_queue(integer, smallint)', 'execute') then
    raise exception 'anon can still drive the outbound queue';
  end if;
  if has_function_privilege('authenticated', 'public.claim_email_queue(integer, smallint)', 'execute') then
    raise exception 'authenticated can still drive the outbound queue';
  end if;
  if has_function_privilege('authenticated', 'public.stage_due_reminders()', 'execute') then
    raise exception 'any signed-in member can still stage the reminder queue';
  end if;
  if has_function_privilege('anon', 'public.record_email_result(bigint, public.email_status, text, text)', 'execute') then
    raise exception 'anon can still write delivery results';
  end if;
  if not has_function_privilege('service_role', 'public.claim_email_queue(integer, smallint)', 'execute') then
    raise exception 'the runner role lost its queue lease grant';
  end if;

  -- In depth: even if a broad grant is restored later, a caller carrying a
  -- subject claim (a signed-in member) must be refused.
  perform set_config('request.jwt.claim.sub',
                     (select id::text from public.users limit 1), true);
  begin
    perform public.claim_email_queue(1);
    raise exception 'a signed-in member was able to claim queue rows';
  exception
    when insufficient_privilege then null;  -- expected refusal
  end;
  begin
    perform public.stage_due_reminders();
    raise exception 'a signed-in member was able to stage reminders';
  exception
    when insufficient_privilege then null;  -- expected refusal
  end;
  perform set_config('request.jwt.claim.sub', '', true);

  raise notice 'queue lease assertions passed';
end
$$;

reset role;
\echo '-- harness complete'

-- ============================================================================
-- 10. caller scoping for the cross-member analytics RPCs (migration 00011).
-- ============================================================================
\echo '-- 10. rpc caller scoping'
reset role;
select set_config('request.jwt.claim.sub', current_setting('harness.borrower'), false);

do $$
declare
  v_me       uuid := auth.uid();
  v_other    uuid;
  v_own      jsonb;
  v_stolen   jsonb;
  v_rows     integer;
begin
  if v_me is null then
    raise exception 'no borrower fixture for the caller-scoping pass';
  end if;

  select u.id into v_other
    from public.users u
   where u.id <> v_me
     and exists (select 1 from public.borrow_transactions bt where bt.borrower_id = u.id)
   limit 1;
  if v_other is null then
    raise exception 'the seed has no second member with loans to test against';
  end if;

  -- A member asking for someone else's summary is answered with their own.
  v_own    := public.borrower_summary(v_me);
  v_stolen := public.borrower_summary(v_other);
  if v_own <> v_stolen then
    raise exception 'borrower_summary() leaked another member''s counts: % vs %', v_own, v_stolen;
  end if;
  if (v_stolen->>'lifetime_loans')::int <>
     (select count(*) from public.borrow_transactions where borrower_id = v_me) then
    raise exception 'borrower_summary() is not reporting the caller''s own loan count';
  end if;

  -- The roster is staff-only.
  select count(*) into v_rows from public.most_active_borrowers(5);
  if v_rows <> 0 then
    raise exception 'most_active_borrowers() returned % rows to a plain member', v_rows;
  end if;

  -- Staff keep both abilities.
  perform set_config('request.jwt.claim.sub',
                     current_setting('harness.librarian'), true);
  if public.borrower_summary(v_other) -> 'lifetime_loans' is null then
    raise exception 'staff lost the ability to read a borrower summary';
  end if;
  if (public.borrower_summary(v_other)->>'lifetime_loans')::int
     <> (select count(*) from public.borrow_transactions where borrower_id = v_other) then
    raise exception 'staff borrower_summary() is not reporting the requested member';
  end if;
  select count(*) into v_rows from public.most_active_borrowers(5);
  if v_rows = 0 then
    raise exception 'most_active_borrowers() is empty for staff';
  end if;

  perform set_config('request.jwt.claim.sub', '', true);
  raise notice 'rpc caller-scoping assertions passed';
end
$$;

reset role;
