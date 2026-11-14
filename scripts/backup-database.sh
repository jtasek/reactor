#!/usr/bin/env bash
# Backs up the database at DATABASE_URL into BACKUP_DIR (default ./backups) as a
# pg_dump custom-format file named by its UTC time, checks that pg_restore can read
# it, then deletes dumps older than BACKUP_KEEP_DAYS (default 14). Prints the file.
# The URL is passed to pg_dump, so on a shared machine leave the password out of it
# and keep it in ~/.pgpass (or PGPASSFILE), where other users' process lists cannot see it.
# Run it daily, for example from cron:
#   15 3 * * * cd /srv/reactor && DATABASE_URL=... scripts/backup-database.sh
set -euo pipefail

: "${DATABASE_URL:?Set DATABASE_URL to the database to back up}"
dir="${BACKUP_DIR:-./backups}"
keep="${BACKUP_KEEP_DAYS:-14}"

mkdir -p "$dir"
file="$dir/reactor-$(date -u +%Y%m%dT%H%M%SZ).dump"

# Written under another name first, so a failed dump is never taken for a backup.
pg_dump --format=custom --no-owner --no-privileges --file="$file.partial" "$DATABASE_URL"
pg_restore --list "$file.partial" >/dev/null
mv "$file.partial" "$file"

find "$dir" -maxdepth 1 -name 'reactor-*.dump' -mtime +"$keep" -delete
echo "$file"
