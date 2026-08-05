#!/usr/bin/env bash
#
# Rehearse pending migrations against a *copy* of a real database.
#
# The CI job `migration-over-data` proves a migration survives a synthetic
# fixture on every pull request. This answers the different question the
# fixture cannot: does it survive *our actual data* — the volume, the nulls,
# the rows nobody remembers creating.
#
# The source database is never migrated. It is dumped, restored into a scratch
# database, and the migrations run there.
#
#   SOURCE_DATABASE_URL="postgresql://..." bun run --filter '@firstloop/db' db:rehearse
#
# There is deliberately no default source: defaulting to anything would
# eventually mean defaulting to production.
#
# pg_dump and psql are run inside the compose Postgres container rather than on
# the host, because the host has no Postgres client installed. The container can
# reach a remote host fine, so a Railway URL works here.
set -euo pipefail

CONTAINER="${PG_CONTAINER:-firstloop-marathon-app-postgres-1}"
SCRATCH_DB="${SCRATCH_DB:-migration_rehearsal}"
LOCAL_ADMIN_URL="postgresql://firstloop:firstloop@localhost:5432/postgres"

if [[ -z "${SOURCE_DATABASE_URL:-}" ]]; then
  echo "error: SOURCE_DATABASE_URL is required." >&2
  echo "  local:      SOURCE_DATABASE_URL=\"\$(grep ^DATABASE_URL .env | cut -d= -f2- | tr -d '\"')\"" >&2
  echo "  production: SOURCE_DATABASE_URL=\"<Railway DATABASE_PUBLIC_URL>\"" >&2
  exit 1
fi

if ! docker exec "$CONTAINER" true 2>/dev/null; then
  echo "error: Postgres container '$CONTAINER' is not running. Try: docker compose up -d" >&2
  exit 1
fi

in_pg() { docker exec -i "$CONTAINER" "$@"; }

echo "==> Source (read-only): ${SOURCE_DATABASE_URL%%\?*}"
echo "==> Scratch database:   $SCRATCH_DB"

echo
echo "==> Row counts in the source, before"
BEFORE=$(in_pg psql "$SOURCE_DATABASE_URL" -t -A -F' ' -c "
  SELECT 'User', count(*) FROM \"User\"
  UNION ALL SELECT 'TrainingPlan', count(*) FROM \"TrainingPlan\"
  UNION ALL SELECT 'PlannedWorkout', count(*) FROM \"PlannedWorkout\"
  UNION ALL SELECT 'SessionLog', count(*) FROM \"SessionLog\";")
echo "$BEFORE"

SCRATCH_URL="postgresql://firstloop:firstloop@localhost:5432/$SCRATCH_DB"

echo
echo "==> Dumping and restoring into $SCRATCH_DB"
in_pg psql "$LOCAL_ADMIN_URL" -v ON_ERROR_STOP=1 -c "DROP DATABASE IF EXISTS \"$SCRATCH_DB\";" >/dev/null
in_pg psql "$LOCAL_ADMIN_URL" -v ON_ERROR_STOP=1 -c "CREATE DATABASE \"$SCRATCH_DB\";" >/dev/null
# One connection string per psql invocation: passing a URL positionally *and*
# -d makes psql read the URL as a username, which fails confusingly.
in_pg sh -c "pg_dump --no-owner --no-privileges '$SOURCE_DATABASE_URL' | psql -q -v ON_ERROR_STOP=1 '$SCRATCH_URL'" >/dev/null

echo
echo "==> Migrations pending on the copy"
DATABASE_URL="$SCRATCH_URL" "$(dirname "$0")/../node_modules/.bin/prisma" migrate status \
  --schema "$(dirname "$0")/../prisma/schema.prisma" || true

echo
echo "==> Applying them"
DATABASE_URL="$SCRATCH_URL" "$(dirname "$0")/../node_modules/.bin/prisma" migrate deploy \
  --schema "$(dirname "$0")/../prisma/schema.prisma"

echo
echo "==> Row counts in the migrated copy, after"
in_pg psql "$SCRATCH_URL" -t -A -F' ' -c "
  SELECT 'User', count(*) FROM \"User\"
  UNION ALL SELECT 'TrainingPlan', count(*) FROM \"TrainingPlan\"
  UNION ALL SELECT 'PlannedWorkout', count(*) FROM \"PlannedWorkout\"
  UNION ALL SELECT 'SessionLog', count(*) FROM \"SessionLog\";"

echo
echo "==> Done. The source was not modified."
echo "    Inspect the copy:  psql \"$SCRATCH_URL\""
echo "    Drop it:           docker exec $CONTAINER psql \"$LOCAL_ADMIN_URL\" -c 'DROP DATABASE \"$SCRATCH_DB\";'"
