-- ============================================================================
-- Enable Demo Accounts (Skip Email Confirmation)
-- ============================================================================
-- This script marks all demo accounts as email-confirmed so they can log in
-- without needing to confirm their email address.
-- ============================================================================

-- Mark demo accounts as email-confirmed
update auth.users
set email_confirmed_at = now()
where email in (
  'admin@rcc.edu.ph',
  'librarian@rcc.edu.ph',
  'circ@rcc.edu.ph',
  'student@rcc.edu.ph',
  'grade6@rcc.edu.ph',
  'shs@rcc.edu.ph',
  'grad@rcc.edu.ph'
);

-- Verify the accounts exist and are confirmed
select
  email,
  email_confirmed_at,
  created_at,
  raw_user_meta_data->>'full_name' as full_name
from auth.users
where email in (
  'admin@rcc.edu.ph',
  'librarian@rcc.edu.ph',
  'circ@rcc.edu.ph',
  'student@rcc.edu.ph',
  'grade6@rcc.edu.ph',
  'shs@rcc.edu.ph',
  'grad@rcc.edu.ph'
)
order by email;
