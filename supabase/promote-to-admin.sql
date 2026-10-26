-- ============================================================================
-- Promote Your Account to Admin
-- ============================================================================
-- Replace YOUR_EMAIL below with the email you used to sign up with Google
-- Then run this script to make yourself an administrator
-- ============================================================================

-- Replace this with your actual Google email
insert into public.user_roles (user_id, role_slug)
select u.id, 'admin'::public.role_slug
  from auth.users u
 where u.email = 'YOUR_EMAIL'
on conflict (user_id, role_slug) do nothing;

-- Verify the role was added
select
  u.email,
  string_agg(r.role_slug::text, ', ' order by r.role_slug) as roles
from auth.users u
left join public.user_roles r on r.user_id = u.id
where u.email = 'YOUR_EMAIL'
group by u.email;
