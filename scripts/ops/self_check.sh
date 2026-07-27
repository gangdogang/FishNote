#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

scripts="backup_postgres.sh check_recent_backup.sh restore_drill.sh _backup_lib.sh self_check.sh"
for script in $scripts; do
  bash -n "$SCRIPT_DIR/$script"
done

"$SCRIPT_DIR/backup_postgres.sh" --help >/dev/null
"$SCRIPT_DIR/check_recent_backup.sh" --help >/dev/null
"$SCRIPT_DIR/restore_drill.sh" --help >/dev/null

grep -q -- 'pg_dump --format=custom' "$SCRIPT_DIR/backup_postgres.sh"
grep -q -- '--single-transaction' "$SCRIPT_DIR/restore_drill.sh"
grep -q -- 'fishnote:disposable-restore-drill' "$SCRIPT_DIR/restore_drill.sh"
grep -q -- 'max_age_hours="24"' "$SCRIPT_DIR/check_recent_backup.sh"

if grep -Eq -- '(^|[[:space:]])(dropdb|createdb)([[:space:]]|$)|--clean|DROP DATABASE' \
  "$SCRIPT_DIR/restore_drill.sh"; then
  printf 'ERROR: restore drill script contains a forbidden destructive operation.\n' >&2
  exit 1
fi

printf 'OK: ops scripts passed syntax and static safety checks.\n'
