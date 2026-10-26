-- ============================================================================
-- Migration 00006: circulation RPCs — the transactional heart of the system.
-- Every rule in the RCC borrowing policy is enforced here, server-side,
-- so the UI can never bypass it.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Eligibility check — reused by the UI (pre-flight) and by borrow_book()
-- ---------------------------------------------------------------------------
create or replace function public.evaluate_borrow_eligibility(p_user_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_user       public.users;
  v_profile    public.profiles;
  v_record     public.borrower_records;
  v_limit      smallint;
  v_reasons    jsonb := '[]'::jsonb;
begin
  select * into v_user from public.users where id = p_user_id;
  if not found then
    return jsonb_build_object('eligible', false, 'reasons',
      jsonb_build_array(jsonb_build_object('code', 'unknown_borrower', 'message', 'Borrower account not found.')));
  end if;

  select * into v_profile from public.profiles where user_id = p_user_id;
  select * into v_record  from public.borrower_records where user_id = p_user_id;

  v_limit := coalesce(v_record.borrowing_limit,
                      public.setting_number('borrowing.student.max_books', 3)::smallint);

  if v_user.is_active = false then
    v_reasons := v_reasons || jsonb_build_array(jsonb_build_object(
      'code', 'account_inactive', 'message', 'This library account is inactive.'));
  end if;

  if v_record.status is distinct from null and v_record.status <> 'active' then
    v_reasons := v_reasons || jsonb_build_array(jsonb_build_object(
      'code', 'account_suspended', 'message', 'Account status is ' || v_record.status || '.'));
  end if;

  if coalesce(v_record.is_blocked, false) then
    v_reasons := v_reasons || jsonb_build_array(jsonb_build_object(
      'code', 'unresolved_penalties',
      'message', coalesce(v_record.block_reason, 'Unresolved penalties must be settled first.')));
  end if;

  if coalesce(v_record.active_loans, 0) >= v_limit then
    v_reasons := v_reasons || jsonb_build_array(jsonb_build_object(
      'code', 'loan_limit_reached',
      'message', 'Borrower already holds ' || v_record.active_loans || ' of ' || v_limit || ' allowed books.'));
  end if;

  -- Policy: students must hold an SBTR before borrowing
  if v_profile.borrower_type = 'student'
     and nullif(coalesce(v_profile.sbtr_number, ''), '') is null then
    v_reasons := v_reasons || jsonb_build_array(jsonb_build_object(
      'code', 'sbtr_required',
      'message', 'A Student Book Tracer Record (SBTR) is required before borrowing.'));
  end if;

  return jsonb_build_object(
    'eligible', jsonb_array_length(v_reasons) = 0,
    'reasons', v_reasons,
    'active_loans', coalesce(v_record.active_loans, 0),
    'borrowing_limit', v_limit,
    'outstanding_fines', coalesce(v_record.outstanding_fines, 0)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- borrow_book() — issue a copy to a borrower
-- ---------------------------------------------------------------------------
create or replace function public.borrow_book(
  p_borrower_id uuid,
  p_copy_id     uuid     default null,
  p_barcode     text     default null,
  p_days        smallint default null,
  p_notes       text     default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_copy     public.book_copies;
  v_book     public.books;
  v_elig     jsonb;
  v_due      timestamptz;
  v_tx_id    uuid;
  v_ref      text;
  v_caller   uuid := auth.uid();
begin
  -- Only staff may issue on behalf of another borrower
  if v_caller is distinct from p_borrower_id and not public.is_librarian() then
    return jsonb_build_object('ok', false, 'code', 'forbidden',
                              'message', 'Only librarians may record a borrow for another member.');
  end if;

  select c.* into v_copy
    from public.book_copies c
   where c.id = p_copy_id or (p_barcode is not null and c.barcode = p_barcode);

  if not found then
    return jsonb_build_object('ok', false, 'code', 'copy_not_found',
                              'message', 'No copy matches that barcode.');
  end if;

  select * into v_book from public.books where id = v_copy.book_id;

  if v_book.is_published = false then
    return jsonb_build_object('ok', false, 'code', 'unpublished',
                              'message', 'This title is not in the public catalogue yet.');
  end if;

  if v_copy.is_library_use_only
     or v_book.section in ('reference', 'periodicals') then
    return jsonb_build_object('ok', false, 'code', 'library_use_only',
                              'message', v_book.title || ' is for library use only and cannot be borrowed.');
  end if;

  if v_copy.status <> 'available' then
    return jsonb_build_object('ok', false, 'code', 'copy_unavailable',
                              'message', 'This copy is ' || v_copy.status || '.');
  end if;

  select public.evaluate_borrow_eligibility(p_borrower_id) into v_elig;
  if (v_elig ->> 'eligible')::text <> 'true' then
    return jsonb_build_object('ok', false, 'code', 'not_eligible',
                              'message', 'Borrower is not eligible.', 'details', v_elig -> 'reasons');
  end if;

  v_due   := public.compute_due_date(v_book.section, now(), p_days);
  v_ref   := 'RCC-' || to_char(now(), 'YYMM') || '-' || lpad(nextval('public.borrow_reference_seq')::text, 5, '0');

  insert into public.borrow_transactions
    (reference_no, borrower_id, book_id, copy_id, library_id, librarian_id,
     status, section, date_borrowed, due_date, sbtr_number, source, notes)
  values
    (v_ref, p_borrower_id, v_book.id, v_copy.id, v_book.library_id, v_caller,
     'active', v_book.section, now(), v_due,
     (select sbtr_number from public.profiles where user_id = p_borrower_id),
     case when v_caller = p_borrower_id then 'self-service' else 'librarian' end,
     p_notes)
  returning id into v_tx_id;

  update public.book_copies set status = 'borrowed' where id = v_copy.id;

  -- Promote the head of the reservation queue if this title is queued
  update public.reservations r
     set status = 'ready', ready_at = now(), copy_id = v_copy.id,
         held_until = now() + interval '2 days'
   where r.book_id = v_book.id and r.status = 'waiting'
     and r.borrower_id = p_borrower_id;

  update public.borrower_records
     set last_borrowed_at = now()
   where user_id = p_borrower_id;

  insert into public.notifications (user_id, type, title, body, link, metadata)
  values (
    p_borrower_id, 'due_reminder', 'Book borrowed: ' || v_book.title,
    'Due on ' || to_char(v_due, 'FMMonth FMDD, YYYY') || '. Reference ' || v_ref || '.',
    '/dashboard/borrowings',
    jsonb_build_object('transaction_id', v_tx_id, 'reference_no', v_ref)
  );

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (v_caller, 'book.borrow', 'borrow_transaction', v_tx_id,
          jsonb_build_object('book_id', v_book.id, 'copy_id', v_copy.id,
                             'borrower_id', p_borrower_id, 'due_date', v_due));

  return jsonb_build_object(
    'ok', true, 'transaction_id', v_tx_id, 'reference_no', v_ref,
    'due_date', v_due, 'title', v_book.title, 'copy_id', v_copy.id);
end;
$$;

-- ---------------------------------------------------------------------------
-- return_book() — check a loan back in and assess any fine automatically
-- ---------------------------------------------------------------------------
create or replace function public.return_book(
  p_transaction_id uuid,
  p_condition      public.return_condition default 'good',
  p_remarks        text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tx        public.borrow_transactions;
  v_fine      numeric(10, 2) := 0;
  v_days      integer := 0;
  v_hours     numeric(8, 2) := 0;
  v_copy_next public.copy_status := 'available';
  v_return_id uuid;
begin
  if not public.is_librarian() then
    return jsonb_build_object('ok', false, 'code', 'forbidden',
                              'message', 'Only library staff can check in books.');
  end if;

  select * into v_tx from public.borrow_transactions where id = p_transaction_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found', 'message', 'Transaction not found.');
  end if;
  if v_tx.status in ('returned', 'cancelled') then
    return jsonb_build_object('ok', false, 'code', 'already_returned',
                              'message', 'This loan was already closed.');
  end if;

  if v_tx.due_date < now() then
    if v_tx.section = 'reserve' then
      v_hours := ceil(extract(epoch from (now() - v_tx.due_date)) / 3600.0);
      v_days  := greatest(1, ceil(v_hours / 24.0)::int);
    else
      v_days  := greatest(1, ceil(extract(epoch from (now() - v_tx.due_date)) / 86400.0)::int);
    end if;
    v_fine := public.calculate_fine(v_tx.section, v_tx.due_date, now());
  end if;

  if p_condition = 'damaged' then v_copy_next := 'damaged'; end if;
  if p_condition = 'lost'    then v_copy_next := 'lost';    end if;

  update public.borrow_transactions
     set status = case when p_condition = 'lost' then 'lost'::public.borrow_status
                        when p_condition = 'damaged' then 'damaged'::public.borrow_status
                        else 'returned'::public.borrow_status end,
         date_returned = now(),
         is_overdue = v_days > 0,
         overdue_days = v_days,
         fine_charged = fine_charged + v_fine
   where id = p_transaction_id;

  insert into public.return_transactions
    (borrow_transaction_id, returned_by, date_returned, condition, is_overdue,
     overdue_days, overdue_hours, fine_assessed, remarks)
  values (p_transaction_id, auth.uid(), now(), p_condition, v_days > 0, v_days, v_hours, v_fine, p_remarks)
  returning id into v_return_id;

  update public.book_copies set status = v_copy_next where id = v_tx.copy_id;

  if v_fine > 0 then
    insert into public.fines (borrower_id, borrow_transaction_id, book_id, type, amount,
                              computed_from, computed_to, unit_count, assessed_by)
    values (v_tx.borrower_id, p_transaction_id, v_tx.book_id,
            case when v_tx.section = 'reserve' then 'reserve_hourly'::public.fine_type
                 else 'overdue_daily'::public.fine_type end,
            v_fine, v_tx.due_date, now(),
            case when v_tx.section = 'reserve' then v_hours else v_days::numeric end,
            auth.uid());
  end if;

  if p_condition in ('damaged', 'lost') then
    insert into public.fines (borrower_id, borrow_transaction_id, book_id, type, amount, assessed_by, notes)
    select v_tx.borrower_id, p_transaction_id, v_tx.book_id,
           case when p_condition = 'lost' then 'lost_book'::public.fine_type
                else 'damaged_book'::public.fine_type end,
           case when p_condition = 'lost' then coalesce(cp.acquisition_price, 0) + 150
                else round(coalesce(cp.acquisition_price, 0) * 0.5, 2) end,
           auth.uid(),
           case when p_condition = 'lost' then 'Replacement cost plus processing fee.'
                else 'Repair cost assessment.' end
      from public.book_copies cp where cp.id = v_tx.copy_id;
  end if;

  perform public.refresh_borrower_record(v_tx.borrower_id);
  perform public.refresh_book_counters(v_tx.book_id);

  insert into public.notifications (user_id, type, title, body, link, metadata)
  values (v_tx.borrower_id,
          case when v_fine > 0 then 'fine_assessed'::public.notification_type
               else 'system'::public.notification_type end,
          case when v_fine > 0 then 'Fine assessed on return' else 'Return recorded' end,
          'Transaction closed. ' ||
            case when v_fine > 0 then 'Fine of PHP ' || to_char(v_fine, 'FM0.00') ||
                 ' (' || v_days || ' day(s) overdue).' else 'No fine incurred.' end,
          '/dashboard/penalties',
          jsonb_build_object('transaction_id', p_transaction_id, 'fine', v_fine));

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), 'book.return', 'borrow_transaction', p_transaction_id,
          jsonb_build_object('fine', v_fine, 'condition', p_condition, 'overdue_days', v_days));

  return jsonb_build_object('ok', true, 'fine', v_fine, 'overdue_days', v_days,
                            'overdue_hours', v_hours, 'copy_status', v_copy_next);
end;
$$;

-- ---------------------------------------------------------------------------
-- extend_due_date() — librarian renews a loan
-- ---------------------------------------------------------------------------
create or replace function public.extend_due_date(
  p_transaction_id uuid,
  p_days integer default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tx public.borrow_transactions;
  v_new_due timestamptz;
  v_days integer := coalesce(p_days, public.setting_number('borrowing.student.duration_days', 7)::int);
begin
  if not public.is_librarian() then
    return jsonb_build_object('ok', false, 'code', 'forbidden',
                              'message', 'Only library staff can extend due dates.');
  end if;

  select * into v_tx from public.borrow_transactions where id = p_transaction_id for update;
  if not found or v_tx.status not in ('active', 'overdue') then
    return jsonb_build_object('ok', false, 'code', 'invalid',
                              'message', 'Only open loans can be extended.');
  end if;

  v_new_due := public.compute_due_date(v_tx.section, now(), v_days::smallint);

  update public.borrow_transactions
     set due_date = v_new_due,
         renewals_used = renewals_used + 1,
         is_overdue = false,
         overdue_days = 0,
         status = 'active'
   where id = p_transaction_id;

  insert into public.notifications (user_id, type, title, body, link)
  values (v_tx.borrower_id, 'system', 'Due date extended',
          'Your loan is now due ' || to_char(v_new_due, 'FMMonth FMDD, YYYY') || '.',
          '/dashboard/borrowings');

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), 'loan.extend', 'borrow_transaction', p_transaction_id,
          jsonb_build_object('new_due_date', v_new_due));

  return jsonb_build_object('ok', true, 'due_date', v_new_due);
end;
$$;

-- ---------------------------------------------------------------------------
-- Fines: settle and waive
-- ---------------------------------------------------------------------------
create or replace function public.settle_fine(p_fine_id uuid, p_paid_via text default 'cash')
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_fine public.fines;
begin
  if not public.is_librarian() then
    return jsonb_build_object('ok', false, 'code', 'forbidden', 'message', 'Staff only.');
  end if;
  select * into v_fine from public.fines where id = p_fine_id for update;
  if not found then return jsonb_build_object('ok', false, 'code', 'not_found'); end if;
  if v_fine.status <> 'pending' then
    return jsonb_build_object('ok', false, 'code', 'closed', 'message', 'Fine is already ' || v_fine.status || '.');
  end if;

  update public.fines set status = 'paid', paid_at = now(), paid_via = p_paid_via where id = p_fine_id;
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), 'fine.settle', 'fine', p_fine_id, jsonb_build_object('amount', v_fine.amount));
  return jsonb_build_object('ok', true, 'amount', v_fine.amount);
end;
$$;

create or replace function public.waive_fine(p_fine_id uuid, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_fine public.fines;
begin
  if not public.is_admin() then
    return jsonb_build_object('ok', false, 'code', 'forbidden', 'message', 'Only administrators may waive penalties.');
  end if;
  select * into v_fine from public.fines where id = p_fine_id for update;
  if not found then return jsonb_build_object('ok', false, 'code', 'not_found'); end if;

  update public.fines set status = 'waived', waiver_reason = p_reason, waived_by = auth.uid()
   where id = p_fine_id;
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), 'fine.waive', 'fine', p_fine_id, jsonb_build_object('reason', p_reason));
  return jsonb_build_object('ok', true);
end;
$$;

-- ---------------------------------------------------------------------------
-- Reservations
-- ---------------------------------------------------------------------------
create or replace function public.reserve_book(p_book_id uuid, p_borrower_id uuid default auth.uid())
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_book public.books;
  v_existing uuid;
  v_pos smallint;
  v_res_id uuid;
begin
  if p_borrower_id is null then
    return jsonb_build_object('ok', false, 'code', 'anonymous', 'message', 'Sign in to reserve a book.');
  end if;

  select * into v_book from public.books where id = p_book_id;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found', 'message', 'Title not found.');
  end if;

  if v_book.section in ('reference', 'periodicals') then
    return jsonb_build_object('ok', false, 'code', 'library_use_only',
                              'message', 'Library-use-only titles cannot be reserved.');
  end if;

  select id into v_existing from public.reservations
   where book_id = p_book_id and borrower_id = p_borrower_id
     and status in ('waiting', 'ready')
   order by requested_at desc limit 1;
  if v_existing is not null then
    return jsonb_build_object('ok', false, 'code', 'already_queued',
                              'message', 'You already have an active reservation for this title.',
                              'reservation_id', v_existing);
  end if;

  select count(*)::smallint + 1 into v_pos from public.reservations
   where book_id = p_book_id and status = 'waiting';

  insert into public.reservations (book_id, borrower_id, status, queue_position)
  values (p_book_id, p_borrower_id,
          case when v_book.available_copies > 0 then 'ready'::public.reservation_status
               else 'waiting'::public.reservation_status end,
          v_pos)
  returning id into v_res_id;

  insert into public.notifications (user_id, type, title, body, link)
  values (p_borrower_id, 'reservation_ready', 'Reservation confirmed: ' || v_book.title,
          case when v_book.available_copies > 0
               then 'A copy is available now — present this at the circulation desk.'
               else 'You are number ' || v_pos || ' in the queue. We will notify you when a copy is free.' end,
          '/dashboard/reservations');

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), 'book.reserve', 'reservation', v_res_id,
          jsonb_build_object('book_id', p_book_id, 'position', v_pos));

  return jsonb_build_object('ok', true, 'reservation_id', v_res_id, 'queue_position', v_pos);
end;
$$;

create or replace function public.cancel_reservation(p_reservation_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_res public.reservations;
begin
  select * into v_res from public.reservations where id = p_reservation_id for update;
  if not found then return jsonb_build_object('ok', false, 'code', 'not_found'); end if;
  if v_res.borrower_id <> coalesce(auth.uid(), v_res.borrower_id) and not public.is_librarian() then
    return jsonb_build_object('ok', false, 'code', 'forbidden');
  end if;
  if v_res.status not in ('waiting', 'ready') then
    return jsonb_build_object('ok', false, 'code', 'closed', 'message', 'Reservation is already ' || v_res.status || '.');
  end if;

  update public.reservations
     set status = 'cancelled', cancelled_at = now()
   where id = p_reservation_id;

  with queue as (
    select id, row_number() over (order by requested_at) as n
      from public.reservations
     where book_id = v_res.book_id and status = 'waiting'
  )
  update public.reservations r
     set queue_position = q.n
    from queue q where r.id = q.id;

  return jsonb_build_object('ok', true);
end;
$$;

-- ---------------------------------------------------------------------------
-- Overdue sweep + reminder staging (called by the scheduled notification job)
-- ---------------------------------------------------------------------------
create or replace function public.stage_due_reminders()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sent  integer := 0;
  v_row   record;
  v_days  integer[] := coalesce(
    (select array_agg(x::int) from jsonb_array_elements_text(public.setting('notifications.reminder_days', '[7,3,1]'::jsonb)) x),
    array[7, 3, 1]
  );
begin
  -- Only the scheduler (cron route, Edge Function, admin console sweep) may
  -- stage mail; a signed-in member must never be able to flood the queue.
  perform public.assert_service_runner();

  for v_row in
    select bt.id as tx_id, bt.borrower_id, u.email, u.full_name, b.title, b.accession_number,
           bt.due_date, d.stage
      from public.borrow_transactions bt
      join public.books b on b.id = bt.book_id
      join public.users u on u.id = bt.borrower_id
      cross join unnest(v_days) as d(stage)
     where bt.status in ('active', 'overdue')
       and date_trunc('day', bt.due_date)::date - date_trunc('day', now())::date = d.stage
       and not exists (
             select 1 from public.email_logs e
              where e.dedupe_key = 'reminder:' || d.stage || ':' || bt.id
           )
  loop
    insert into public.email_logs (recipient, user_id, template, subject, body, dedupe_key, borrow_transaction_id)
    values (v_row.email, v_row.borrower_id, 'due_reminder',
            'Return reminder (' || v_row.stage || ' days): ' || v_row.title,
            v_row.full_name || ', please return "' || v_row.title || '" (accession '
              || coalesce(v_row.accession_number, '-') || ') by '
              || to_char(v_row.due_date, 'FMMonth FMDD, YYYY') || '.',
            'reminder:' || v_row.stage || ':' || v_row.tx_id, v_row.tx_id);

    insert into public.notifications (user_id, type, title, body, link)
    values (v_row.borrower_id, 'due_reminder',
            v_row.stage || ' day(s) until "' || v_row.title || '" is due',
            'Due ' || to_char(v_row.due_date, 'FMMonth FMDD, YYYY') || '.', '/dashboard/borrowings');

    v_sent := v_sent + 1;
  end loop;

  -- Overdue notice (once per loan)
  for v_row in
    select bt.id as tx_id, bt.section, bt.borrower_id, u.email, u.full_name, b.title,
           b.accession_number, bt.due_date
      from public.borrow_transactions bt
      join public.books b on b.id = bt.book_id
      join public.users u on u.id = bt.borrower_id
     where bt.status in ('active', 'overdue') and bt.due_date < now()
       and not exists (select 1 from public.email_logs e where e.dedupe_key = 'overdue:' || bt.id)
  loop
    insert into public.email_logs (recipient, user_id, template, subject, body, dedupe_key, borrow_transaction_id)
    values (v_row.email, v_row.borrower_id, 'overdue_notice',
            'OVERDUE: ' || v_row.title || ' — fine accruing',
            v_row.full_name || ', "' || v_row.title || '" (accession '
              || coalesce(v_row.accession_number, '-') || ') was due '
              || to_char(v_row.due_date, 'FMMonth FMDD, YYYY') || '. A fine of PHP '
              || to_char(public.calculate_fine(v_row.section, v_row.due_date, now()), 'FM0.00')
              || ' is accruing.',
            'overdue:' || v_row.tx_id, v_row.tx_id);
    v_sent := v_sent + 1;
  end loop;

  return jsonb_build_object('staged', v_sent, 'overdue_marked', public.mark_overdue_loans());
end;
$$;
