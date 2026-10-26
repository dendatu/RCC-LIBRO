-- RCC LIBRO — local-stack auth helpers.
--
-- Mounted at /docker-entrypoint-initdb.d/migrations/9910-auth-helpers.sql, so
-- the Supabase image applies it right after 9900-rcc-libro-schema.sql, on a
-- fresh volume only. Recreate the stack with `docker compose down -v` to re-run
-- the schema.

-- Every policy and RPC in this project resolves the caller through auth.uid(),
-- which PostgREST feeds from the `request.jwt.claim.sub` / `request.jwt.claims`
-- GUCs. The Supabase image already defines the uid/role/jwt trio to read both
-- forms — the legacy per-claim GUC and the JSON document that PostgREST 10+
-- writes — and owns them as supabase_auth_admin, the role GoTrue migrates as.
-- So this file deliberately does NOT redefine them: replacing them here would
-- hand ownership to supabase_admin and GoTrue's first boot would abort with
-- "must be owner of function jwt".
--
-- What it does need to do is make sure the three API roles can call them. The
-- image grants that already on most builds; this is a repair, not an assumption,
-- and it skips whatever is missing because auth.jwt() only appears once GoTrue
-- has run its own migrations.
do $$
declare
  f text;
begin
  foreach f in array array['auth.uid()', 'auth.role()', 'auth.jwt()', 'auth.email()'] loop
    if to_regfunction(f) is not null then
      execute format('grant execute on function %s to anon, authenticated, service_role', f);
    end if;
  end loop;
end
$$;

-- Migration 00005 attaches handle_new_user() to auth.users and the service-role
-- client writes profile rows for accounts created through the admin API, so the
-- service role needs usage on the auth schema. (GoTrue owns the tables; direct
-- writes to auth.users are still neither needed nor used.)
grant usage on schema auth to anon, authenticated, service_role;
