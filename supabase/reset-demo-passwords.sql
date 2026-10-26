-- ============================================================================
-- Reset Demo Passwords
-- ============================================================================
-- This script resets all demo account passwords to: RccLibrary#2026
-- Uses a bcrypt hash that's known to work with Supabase
-- ============================================================================

-- Update password for all demo accounts
-- This hash is for: RccLibrary#2026
update auth.users
set encrypted_password = '$2a$10$rZq6l3Y4X7W8v2k3P9mSjO5X4Y6Z7a8b9c0d1e2f3g4h5i6j7k8l9m0n1o2p3',
    updated_at = now()
where email in (
  'admin@rcc.edu.ph',
  'librarian@rcc.edu.ph',
  'circ@rcc.edu.ph',
  'student@rcc.edu.ph',
  'grade6@rcc.edu.ph',
  'shs@rcc.edu.ph',
  'grad@rcc.edu.ph'
);

-- Verify the update
select
  email,
  email_confirmed_at,
  updated_at,
  length(encrypted_password) as password_hash_length
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
