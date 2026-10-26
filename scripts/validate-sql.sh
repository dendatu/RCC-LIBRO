#!/usr/bin/env bash
# Applies every RCC LIBRO migration to a throwaway PostgreSQL container and runs
# the assertion pass, so schema mistakes surface before the project is deployed.
#
# Usage: bash scripts/validate-sql.sh [--keep] [--paste]
#   --paste  apply the consolidated SQL-editor files (supabase/schema.sql +
#            supabase/seed-demo.sql + supabase/check-and-admin.sql) exactly as a
#            human would paste them, instead of the numbered migrations.
set -euo pipefail

NAME=rcc-libro-schema-check
IMAGE=postgres:16-alpine
KEEP=""
PASTE=""
for arg in "$@"; do
  case "$arg" in
    --keep) KEEP="--keep" ;;
    --paste) PASTE="--paste" ;;
    *) echo "unknown option: $arg" >&2; exit 2 ;;
  esac
done
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

fail() { echo "FAILED: $1" >&2; [ "$KEEP" = "--keep" ] || docker rm -f "$NAME" >/dev/null 2>&1; exit 1; }

command -v docker >/dev/null || fail "docker is not available"
docker info >/dev/null 2>&1 || fail "the docker daemon is not running (start Docker Desktop)"

echo "==> recreating $NAME"
docker rm -f "$NAME" >/dev/null 2>&1 || true
docker run -d --name "$NAME" -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=rcc_libro "$IMAGE" >/dev/null \
  || fail "could not start $IMAGE"

echo "==> waiting for postgres"
for _ in $(seq 1 60); do
  docker exec "$NAME" pg_isready -U postgres -d rcc_libro >/dev/null 2>&1 && break
  sleep 2
done
docker exec "$NAME" pg_isready -U postgres -d rcc_libro >/dev/null 2>&1 || fail "postgres never became ready"

run_sql() {
  local label="$1" file="$2"
  echo "==> applying $(basename "$file")"
  docker exec -i "$NAME" psql -v ON_ERROR_STOP=1 -q -U postgres -d rcc_libro \
    < "$file" || fail "$label $(basename "$file")"
}

run_sql "shim" "$ROOT/supabase/local/auth_shim.sql"
if [ "$PASTE" = "--paste" ]; then
  run_sql "editor paste" "$ROOT/supabase/schema.sql"
  run_sql "editor paste" "$ROOT/supabase/seed-demo.sql"
  run_sql "editor paste" "$ROOT/supabase/check-and-admin.sql"
  echo "==> running the assertion pass against the pasted schema"
  run_sql "assertions" "$ROOT/supabase/local/verify.sql"
  echo
  echo "SQL-editor paste path succeeded: schema.sql + seed-demo.sql + check-and-admin.sql."
else
  for file in "$ROOT"/supabase/migrations/*.sql; do run_sql "migration" "$file"; done
  run_sql "assertions" "$ROOT/supabase/local/verify.sql"
  echo
  echo "All $(ls "$ROOT"/supabase/migrations/*.sql | wc -l | tr -d ' ') migrations applied and the assertion pass succeeded."
fi

if [ "$KEEP" = "--keep" ]; then
  echo "Container left running: docker exec -it $NAME psql -U postgres -d rcc_libro"
else
  docker rm -f "$NAME" >/dev/null
fi
