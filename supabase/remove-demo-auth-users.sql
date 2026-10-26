-- ============================================================================
-- Remove Demo Auth Users
-- ============================================================================
-- This removes the demo accounts from auth.users so you can sign up fresh
-- using Google OAuth
-- ============================================================================

-- Delete from public tables first (foreign key dependencies)
-- Order matters: delete from child tables before parent tables

-- Delete fines (depends on borrow_transactions)
delete from public.fines
where borrower_id in (
  select id from auth.users where email in (
    'admin@rcc.edu.ph',
    'librarian@rcc.edu.ph',
    'circ@rcc.edu.ph',
    'student@rcc.edu.ph',
    'grade6@rcc.edu.ph',
    'shs@rcc.edu.ph',
    'grad@rcc.edu.ph'
  )
);

-- Delete return transactions (depends on borrow_transactions)
delete from public.return_transactions
where librarian_id in (
  select id from auth.users where email in (
    'admin@rcc.edu.ph',
    'librarian@rcc.edu.ph',
    'circ@rcc.edu.ph',
    'student@rcc.edu.ph',
    'grade6@rcc.edu.ph',
    'shs@rcc.edu.ph',
    'grad@rcc.edu.ph'
  )
);

-- Delete borrow transactions (depends on users, books, copies)
delete from public.borrow_transactions
where borrower_id in (
  select id from auth.users where email in (
    'admin@rcc.edu.ph',
    'librarian@rcc.edu.ph',
    'circ@rcc.edu.ph',
    'student@rcc.edu.ph',
    'grade6@rcc.edu.ph',
    'shs@rcc.edu.ph',
    'grad@rcc.edu.ph'
  )
)
or librarian_id in (
  select id from auth.users where email in (
    'admin@rcc.edu.ph',
    'librarian@rcc.edu.ph',
    'circ@rcc.edu.ph',
    'student@rcc.edu.ph',
    'grade6@rcc.edu.ph',
    'shs@rcc.edu.ph',
    'grad@rcc.edu.ph'
  )
);

-- Delete reservations
delete from public.reservations
where borrower_id in (
  select id from auth.users where email in (
    'admin@rcc.edu.ph',
    'librarian@rcc.edu.ph',
    'circ@rcc.edu.ph',
    'student@rcc.edu.ph',
    'grade6@rcc.edu.ph',
    'shs@rcc.edu.ph',
    'grad@rcc.edu.ph'
  )
);

-- Delete notifications
delete from public.notifications
where user_id in (
  select id from auth.users where email in (
    'admin@rcc.edu.ph',
    'librarian@rcc.edu.ph',
    'circ@rcc.edu.ph',
    'student@rcc.edu.ph',
    'grade6@rcc.edu.ph',
    'shs@rcc.edu.ph',
    'grad@rcc.edu.ph'
  )
);

-- Delete user_roles
delete from public.user_roles
where user_id in (
  select id from auth.users where email in (
    'admin@rcc.edu.ph',
    'librarian@rcc.edu.ph',
    'circ@rcc.edu.ph',
    'student@rcc.edu.ph',
    'grade6@rcc.edu.ph',
    'shs@rcc.edu.ph',
    'grad@rcc.edu.ph'
  )
);

-- Delete borrower_records
delete from public.borrower_records
where user_id in (
  select id from auth.users where email in (
    'admin@rcc.edu.ph',
    'librarian@rcc.edu.ph',
    'circ@rcc.edu.ph',
    'student@rcc.edu.ph',
    'grade6@rcc.edu.ph',
    'shs@rcc.edu.ph',
    'grad@rcc.edu.ph'
  )
);

-- Delete profiles
delete from public.profiles
where user_id in (
  select id from auth.users where email in (
    'admin@rcc.edu.ph',
    'librarian@rcc.edu.ph',
    'circ@rcc.edu.ph',
    'student@rcc.edu.ph',
    'grade6@rcc.edu.ph',
    'shs@rcc.edu.ph',
    'grad@rcc.edu.ph'
  )
);

-- Delete audit logs
delete from public.audit_logs
where actor_id in (
  select id from auth.users where email in (
    'admin@rcc.edu.ph',
    'librarian@rcc.edu.ph',
    'circ@rcc.edu.ph',
    'student@rcc.edu.ph',
    'grade6@rcc.edu.ph',
    'shs@rcc.edu.ph',
    'grad@rcc.edu.ph'
  )
);

-- Delete users
delete from public.users
where id in (
  select id from auth.users where email in (
    'admin@rcc.edu.ph',
    'librarian@rcc.edu.ph',
    'circ@rcc.edu.ph',
    'student@rcc.edu.ph',
    'grade6@rcc.edu.ph',
    'shs@rcc.edu.ph',
    'grad@rcc.edu.ph'
  )
);

-- Finally delete from auth.users
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

-- Verify deletion
select count(*) as remaining_demo_users
from auth.users
where email in (
  'admin@rcc.edu.ph',
  'librarian@rcc.edu.ph',
  'circ@rcc.edu.ph',
  'student@rcc.edu.ph',
  'grade6@rcc.edu.ph',
  'shs@rcc.edu.ph',
  'grad@rcc.edu.ph'
);
