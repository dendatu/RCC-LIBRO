-- ============================================================================
-- Migration 00008: Row Level Security
--
-- Design notes
--   * Every policy calls a SECURITY DEFINER helper (has_role / is_librarian /
--     is_admin) so policies never recurse into public.user_roles.
--   * The catalogue is world-readable for OPAC; only published rows leak.
--   * Write paths for members are funnelled through RPCs, which run as the
--     function owner — direct table writes are staff-only.
-- ============================================================================

alter table public.users              enable row level security;
alter table public.roles              enable row level security;
alter table public.user_roles         enable row level security;
alter table public.libraries          enable row level security;
alter table public.book_categories    enable row level security;
alter table public.books              enable row level security;
alter table public.book_copies        enable row level security;
alter table public.book_records       enable row level security;
alter table public.profiles           enable row level security;
alter table public.borrower_records   enable row level security;
alter table public.settings           enable row level security;
alter table public.audit_logs         enable row level security;
alter table public.borrow_transactions   enable row level security;
alter table public.return_transactions   enable row level security;
alter table public.fines               enable row level security;
alter table public.reservations        enable row level security;
alter table public.notifications       enable row level security;
alter table public.email_logs          enable row level security;

-- ---------------------------------------------------------------------------
-- users
-- ---------------------------------------------------------------------------
create policy users_read on public.users
  for select to authenticated
  using (id = auth.uid() or public.is_librarian());

create policy users_update_self on public.users
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

create policy users_staff_write on public.users
  for insert to authenticated
  with check (public.is_admin() or id = auth.uid());

create policy users_admin_write on public.users
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- roles / user_roles
-- ---------------------------------------------------------------------------
create policy roles_read on public.roles for select to authenticated using (true);
create policy roles_admin_write on public.roles for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy user_roles_read on public.user_roles
  for select to authenticated using (user_id = auth.uid() or public.is_librarian());

create policy user_roles_admin_write on public.user_roles
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- Reference data: branches + categories (public read for OPAC)
-- ---------------------------------------------------------------------------
create policy libraries_read on public.libraries for select using (is_active);
create policy libraries_write on public.libraries for all to authenticated
  using (public.is_librarian()) with check (public.is_librarian());

create policy categories_read on public.book_categories for select using (is_active);
create policy categories_write on public.book_categories for all to authenticated
  using (public.is_librarian()) with check (public.is_librarian());

-- ---------------------------------------------------------------------------
-- Catalogue
-- ---------------------------------------------------------------------------
create policy books_read on public.books
  for select using (is_published or public.is_librarian());

create policy books_write on public.books
  for all to authenticated using (public.is_librarian()) with check (public.is_librarian());

create policy copies_read on public.book_copies for select to authenticated using (true);
create policy copies_anon_read on public.book_copies
  for select to anon using (status in ('available', 'borrowed'));

create policy copies_write on public.book_copies
  for all to authenticated using (public.is_librarian()) with check (public.is_librarian());

create policy book_records_read on public.book_records for select using (true);
create policy book_records_write on public.book_records
  for all to authenticated using (public.is_librarian()) with check (public.is_librarian());

-- ---------------------------------------------------------------------------
-- Member profiles & standing
-- ---------------------------------------------------------------------------
create policy profiles_read on public.profiles
  for select to authenticated using (user_id = auth.uid() or public.is_librarian());

create policy profiles_update_self on public.profiles
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy profiles_insert_self on public.profiles
  for insert to authenticated with check (user_id = auth.uid() or public.is_librarian());

create policy profiles_staff_write on public.profiles
  for all to authenticated using (public.is_librarian()) with check (public.is_librarian());

create policy borrower_records_read on public.borrower_records
  for select to authenticated using (user_id = auth.uid() or public.is_librarian());

create policy borrower_records_write on public.borrower_records
  for all to authenticated using (public.is_librarian()) with check (public.is_librarian());

-- ---------------------------------------------------------------------------
-- Circulation
-- ---------------------------------------------------------------------------
create policy loans_read on public.borrow_transactions
  for select to authenticated using (borrower_id = auth.uid() or public.is_librarian());

create policy loans_write on public.borrow_transactions
  for all to authenticated using (public.is_librarian()) with check (public.is_librarian());

create policy returns_read on public.return_transactions
  for select to authenticated
  using (public.is_librarian()
         or exists (select 1 from public.borrow_transactions bt
                     where bt.id = borrow_transaction_id and bt.borrower_id = auth.uid()));

create policy returns_write on public.return_transactions
  for all to authenticated using (public.is_librarian()) with check (public.is_librarian());

create policy fines_read on public.fines
  for select to authenticated using (borrower_id = auth.uid() or public.is_librarian());

create policy fines_write on public.fines
  for all to authenticated using (public.is_librarian()) with check (public.is_librarian());

create policy reservations_read on public.reservations
  for select to authenticated using (borrower_id = auth.uid() or public.is_librarian());

create policy reservations_insert on public.reservations
  for insert to authenticated with check (borrower_id = auth.uid() or public.is_librarian());

create policy reservations_update on public.reservations
  for update to authenticated
  using (borrower_id = auth.uid() and status in ('waiting', 'ready'))
  with check (borrower_id = auth.uid());

create policy reservations_staff_write on public.reservations
  for all to authenticated using (public.is_librarian()) with check (public.is_librarian());

-- ---------------------------------------------------------------------------
-- Notifications / e-mail journal / audit / settings
-- ---------------------------------------------------------------------------
create policy notifications_read on public.notifications
  for select to authenticated using (user_id = auth.uid());

create policy notifications_update on public.notifications
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy notifications_write on public.notifications
  for insert to authenticated with check (public.is_librarian());

create policy email_logs_read on public.email_logs
  for select to authenticated using (public.is_admin() or user_id = auth.uid());

create policy email_logs_write on public.email_logs
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy audit_logs_read on public.audit_logs
  for select to authenticated using (public.is_admin());

create policy audit_logs_write on public.audit_logs
  for insert to authenticated with check (public.is_admin());

create policy settings_read on public.settings for select to authenticated using (true);
create policy settings_write on public.settings
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
grant usage on schema public to anon, authenticated;

grant select on public.libraries, public.book_categories, public.books,
                 public.book_records, public.book_inventory_view to anon;

grant execute on function public.search_books(text, bigint, text, bigint, text, boolean, integer, integer) to anon, authenticated;
grant execute on function public.recently_added(integer) to anon, authenticated;
grant execute on function public.has_role(uuid, public.role_slug) to authenticated;
grant execute on function public.primary_role(uuid) to authenticated;
grant execute on function public.setting(text, jsonb) to authenticated;
grant execute on function public.setting_number(text, numeric) to authenticated;
grant execute on function public.compute_due_date(public.circulation_section, timestamptz, smallint) to authenticated;
grant execute on function public.calculate_fine(public.circulation_section, timestamptz, timestamptz) to authenticated;

grant execute on function
  public.evaluate_borrow_eligibility(uuid),
  public.borrow_book(uuid, uuid, text, smallint, text),
  public.return_book(uuid, public.return_condition, text),
  public.extend_due_date(uuid, integer),
  public.settle_fine(uuid, text),
  public.waive_fine(uuid, text),
  public.reserve_book(uuid, uuid),
  public.cancel_reservation(uuid),
  public.borrower_summary(uuid),
  public.dashboard_stats(),
  public.borrowing_trends(integer),
  public.popular_books(integer),
  public.popular_categories(integer),
  public.branch_usage(),
  public.most_active_borrowers(integer),
  public.mark_overdue_loans(),
  public.stage_due_reminders(),
  public.refresh_borrower_record(uuid),
  public.refresh_book_counters(uuid)
to authenticated;

-- The scheduled reminder job runs with the service key and needs no policy.
revoke all on public.email_logs, public.audit_logs from anon;
