#!/usr/bin/env bash
# Valida migrations + RLS em Postgres 15 descartável (sem Supabase CLI).
set -euo pipefail
cd "$(dirname "$0")/.."
NAME=mm-pg-test-$$
docker run -d --rm --name "$NAME" -e POSTGRES_PASSWORD=test postgres:15-alpine >/dev/null
trap 'docker stop "$NAME" >/dev/null' EXIT
until docker exec "$NAME" pg_isready -U postgres >/dev/null 2>&1; do sleep 0.5; done
sleep 1
run() { docker exec -i "$NAME" psql -q -v ON_ERROR_STOP=1 -U postgres "$@"; }
run < tests/auth-stub.sql
for f in migrations/*.sql; do run < "$f"; done
run < tests/rls.plain.sql
