-- ============================================================================
-- Cleanup Demo Data
-- ============================================================================
-- Run this BEFORE seed-demo.sql to remove existing demo data and start fresh
-- ============================================================================

-- Delete demo transactions (RCC-H and RCC- reference numbers)
delete from public.fines where borrow_transaction_id in (
  select id from public.borrow_transactions
  where reference_no like 'RCC-H%' or reference_no like 'RCC-26%'
);

delete from public.borrow_transactions
where reference_no like 'RCC-H%' or reference_no like 'RCC-26%';

-- Delete demo reservations
delete from public.reservations
where book_id in (select id from public.books where accession_number like 'ACC-2024-%');

-- Delete demo books and copies
delete from public.book_copies
where book_id in (select id from public.books where accession_number like 'ACC-2024-%');

delete from public.books
where accession_number like 'ACC-2024-%';

-- Delete demo users
delete from public.user_roles
where user_id in (select id from auth.users where email in (
  'admin@rcc.edu.ph',
  'librarian@rcc.edu.ph',
  'circ@rcc.edu.ph',
  'student@rcc.edu.ph',
  'grade6@rcc.edu.ph',
  'shs@rcc.edu.ph',
  'grad@rcc.edu.ph'
));

delete from public.profiles
where user_id in (select id from auth.users where email in (
  'admin@rcc.edu.ph',
  'librarian@rcc.edu.ph',
  'circ@rcc.edu.ph',
  'student@rcc.edu.ph',
  'grade6@rcc.edu.ph',
  'shs@rcc.edu.ph',
  'grad@rcc.edu.ph'
));

delete from public.borrower_records
where user_id in (select id from auth.users where email in (
  'admin@rcc.edu.ph',
  'librarian@rcc.edu.ph',
  'circ@rcc.edu.ph',
  'student@rcc.edu.ph',
  'grade6@rcc.edu.ph',
  'shs@rcc.edu.ph',
  'grad@rcc.edu.ph'
));

delete from public.users
where id in (select id from auth.users where email in (
  'admin@rcc.edu.ph',
  'librarian@rcc.edu.ph',
  'circ@rcc.edu.ph',
  'student@rcc.edu.ph',
  'grade6@rcc.edu.ph',
  'shs@rcc.edu.ph',
  'grad@rcc.edu.ph'
));

delete from auth.users
where email in (
  'admin@rcc.edu.ph',
  'librarian@rcc.edu.ph',
  'circ@rcc.edu.ph',
  'student@rcc.edu.ph',
  'grade6@rcc.edu.ph',
  'shs@rcc.edu.ph',
  'grad@rcc.edu.ph'
);

-- Delete demo audit logs
delete from public.audit_logs
where metadata->>'migration' = '00009_seed_demo';
