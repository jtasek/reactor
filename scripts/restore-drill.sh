#!/usr/bin/env bash
# The restore drill: backs up DATABASE_URL with backup-database.sh, restores that
# dump into the empty database at DRILL_DATABASE_URL, and compares the two: the
# row count of every table, and a checksum of every document's saved content and
# snapshots. Exits non-zero when anything differs. It refuses a drill database that
# already has tables, so it never restores over a database in use. A database in use
# may change during the drill; run it again if only the newest rows differ.
set -euo pipefail

: "${DATABASE_URL:?Set DATABASE_URL to the database to back up}"
: "${DRILL_DATABASE_URL:?Set DRILL_DATABASE_URL to an empty scratch database}"

if [ "$DATABASE_URL" = "$DRILL_DATABASE_URL" ]; then
    echo "DRILL_DATABASE_URL must be another database than DATABASE_URL" >&2
    exit 2
fi

query() { psql --no-psqlrc --quiet --tuples-only --no-align --set ON_ERROR_STOP=1 "$1" -c "$2"; }

tables="select count(*) from information_schema.tables where table_schema in ('public', 'auth')"
if [ "$(query "$DRILL_DATABASE_URL" "$tables")" != "0" ]; then
    echo "The drill database already has tables; give it an empty one" >&2
    exit 2
fi

started=$(date +%s)
dump=$("$(dirname "$0")/backup-database.sh")
pg_restore --no-owner --no-privileges --exit-on-error --dbname="$DRILL_DATABASE_URL" "$dump"
restored=$(date +%s)

# One line per table: its schema-qualified name and row count, then content checksums.
summary() {
    query "$1" "
        select format('%I.%I', table_schema, table_name) from information_schema.tables
        where table_schema in ('public', 'auth') and table_type = 'BASE TABLE'
        order by 1" |
        while read -r table; do
            echo "$table $(query "$1" "select count(*) from $table")"
        done
    echo "document_states.checksum $(query "$1" \
        "select coalesce(md5(string_agg(document_id || md5(state), ',' order by document_id)), '-') from document_states")"
    echo "document_snapshots.checksum $(query "$1" \
        "select coalesce(md5(string_agg(id || md5(state), ',' order by id)), '-') from document_snapshots")"
}

source_summary=$(summary "$DATABASE_URL")
drill_summary=$(summary "$DRILL_DATABASE_URL")

echo "Dump: $dump ($(du -h "$dump" | cut -f1)), restored in $((restored - started)) s"
if diff <(echo "$source_summary") <(echo "$drill_summary"); then
    echo "$source_summary"
    echo "Restore drill passed: every table and checksum matches."
else
    echo "Restore drill failed: the lines above differ (< source, > restored)." >&2
    exit 1
fi
