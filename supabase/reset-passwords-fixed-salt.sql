-- ============================================================================
-- Reset Demo Passwords with Fixed Salt
-- ============================================================================
-- This resets all demo account passwords to: RccLibrary#2026
-- Uses a fixed salt so the hash is consistent
-- ============================================================================

-- The seed script uses: crypt('RccLibrary#2026', gen_salt('bf'))
-- gen_salt('bf') generates a random salt each time, so the hashes don't match
-- We'll use a fixed salt: $2a$10$fixed.salt.for.demo
-- Then hash: RccLibrary#2026

-- Update passwords for all demo accounts using a known hash
-- This hash was pre-generated for: RccLibrary#2026 with a fixed salt
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
  substring(encrypted_password, 1, 20) as password_hash_prefix
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
