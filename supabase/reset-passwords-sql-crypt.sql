-- ============================================================================
-- Reset Demo Passwords Using SQL crypt() with Fixed Salt
-- ============================================================================
-- This resets all demo account passwords to: RccLibrary#2026
-- Uses crypt() with a fixed salt so the hash is consistent
-- ============================================================================

-- Use a fixed salt: $2a$10$demodemosalt (22 characters after $2a$10$)
-- The full salt string is: $2a$10$demodemosalt22222
update auth.users
set encrypted_password = crypt('RccLibrary#2026', '$2a$10$demodemosalt22222'),
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
  encrypted_password
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
