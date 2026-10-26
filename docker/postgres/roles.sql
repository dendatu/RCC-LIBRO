-- RCC LIBRO — give the managed API roles their passwords.
--
-- Mounted at /docker-entrypoint-initdb.d/migrations/9990-roles.sql, so the
-- Supabase image applies it after its own scripts and after our schema. The
-- image creates `authenticator` and `supabase_auth_admin` with no password at
-- all, while its pg_hba.conf demands scram-sha-256 from the docker network —
-- without this file PostgREST and GoTrue cannot connect. Mirrors what the
-- official supabase/docker install does in volumes/db/roles.sql.
--
-- Runs as supabase_admin, i.e. a superuser, on a fresh volume only.

-- psql reads POSTGRES_PASSWORD from the environment migrate.sh exported, and
-- hands it to the session as a placeholder GUC: variable substitution does not
-- reach inside the dollar-quoted block below.
\set pgpass `echo "$POSTGRES_PASSWORD"`
set rcc.local_password = :'pgpass';

do $$
declare
  r text;
begin
  -- Not every Supabase build carries every admin role, and an unknown role
  -- would abort initdb, so alter only the ones present.
  foreach r in array array[
    'postgres', 'supabase_admin', 'authenticator', 'supabase_auth_admin',
    'supabase_storage_admin', 'supabase_functions_admin',
    'supabase_replication_admin', 'supabase_read_only_user'
  ] loop
    if exists (select 1 from pg_roles where rolname = r) then
      execute format('alter role %I with password %L', r, current_setting('rcc.local_password'));
    end if;
  end loop;
end
$$;
