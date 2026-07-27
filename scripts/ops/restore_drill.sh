#!/usr/bin/env bash
set -euo pipefail
set +x
umask 077

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=_backup_lib.sh
source "$SCRIPT_DIR/_backup_lib.sh"

usage() {
  cat <<'USAGE'
Usage:
  restore_drill.sh \
    --backup /absolute/path/fishnote_YYYYMMDDTHHMMSSZ.dump.age \
    --work-dir /absolute/protected/work/path \
    --record-dir /absolute/drill-record/path \
    --target-url-env FISHNOTE_RESTORE_TARGET_URL \
    --target-database fishnote_restore_drill_YYYYMMDD_suffix \
    --confirm-disposable-target DISPOSABLE:fishnote_restore_drill_YYYYMMDD_suffix \
    --age-identity-file /absolute/path/to/age-identity

For GPG artifacts, replace --age-identity-file with:
    --gpg-homedir /absolute/scoped/gnupg-home

The target URL environment variable must already be injected by a secret
manager. The target database must already exist, be empty in the public schema, have
the exact database comment "fishnote:disposable-restore-drill", and match the
strict disposable name and confirmation. This script never creates, drops,
cleans, or overwrites a database. The restore runs in one transaction.
USAGE
}

backup=""
work_dir="${BACKUP_WORK_DIR:-}"
record_dir=""
target_url_env=""
target_database=""
target_confirmation=""
age_identity_file="${AGE_IDENTITY_FILE:-}"
gpg_home="${GPG_HOME:-}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --backup) [[ $# -ge 2 ]] || ops_die "--backup 값이 필요합니다."; backup="$2"; shift 2 ;;
    --work-dir) [[ $# -ge 2 ]] || ops_die "--work-dir 값이 필요합니다."; work_dir="$2"; shift 2 ;;
    --record-dir) [[ $# -ge 2 ]] || ops_die "--record-dir 값이 필요합니다."; record_dir="$2"; shift 2 ;;
    --target-url-env) [[ $# -ge 2 ]] || ops_die "--target-url-env 값이 필요합니다."; target_url_env="$2"; shift 2 ;;
    --target-database) [[ $# -ge 2 ]] || ops_die "--target-database 값이 필요합니다."; target_database="$2"; shift 2 ;;
    --confirm-disposable-target) [[ $# -ge 2 ]] || ops_die "--confirm-disposable-target 값이 필요합니다."; target_confirmation="$2"; shift 2 ;;
    --age-identity-file) [[ $# -ge 2 ]] || ops_die "--age-identity-file 값이 필요합니다."; age_identity_file="$2"; shift 2 ;;
    --gpg-homedir) [[ $# -ge 2 ]] || ops_die "--gpg-homedir 값이 필요합니다."; gpg_home="$2"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) ops_die "알 수 없는 인자가 있습니다. --help로 사용법을 확인하세요." ;;
  esac
done

[[ -n "$backup" ]] || ops_die "--backup을 명시해야 합니다."
[[ -n "$work_dir" ]] || ops_die "--work-dir 또는 BACKUP_WORK_DIR을 명시해야 합니다."
[[ -n "$record_dir" ]] || ops_die "--record-dir를 명시해야 합니다."
[[ -n "$target_url_env" ]] || ops_die "--target-url-env를 명시해야 합니다."
[[ "$target_url_env" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]] \
  || ops_die "--target-url-env는 안전한 환경변수 이름이어야 합니다."
[[ "$target_database" =~ ^fishnote_restore_drill_[0-9]{8}_[a-z0-9][a-z0-9_]{3,31}$ ]] \
  || ops_die "대상 DB 이름은 fishnote_restore_drill_YYYYMMDD_suffix 규칙이어야 합니다."
[[ "$target_confirmation" == "DISPOSABLE:${target_database}" ]] \
  || ops_die "폐기 가능 대상 확인 문자열이 정확히 일치하지 않습니다."

ops_require_absolute_readable_file "백업" "$backup"
ops_validate_backup_basename "$(basename "$backup")"
ops_require_absolute_dir "보호된 작업" "$work_dir"
ops_require_absolute_dir "drill 기록" "$record_dir"

case "$backup" in
  *.dump.age)
    [[ -z "$gpg_home" ]] || ops_die "age 백업 복원에 GPG home을 함께 지정할 수 없습니다."
    ops_require_absolute_readable_file "age identity" "$age_identity_file"
    ;;
  *.dump.gpg)
    [[ -z "$age_identity_file" ]] || ops_die "GPG 백업 복원에 age identity를 함께 지정할 수 없습니다."
    ops_require_absolute_dir "GPG home" "$gpg_home"
    ;;
esac

ops_require_command pg_restore
ops_require_command psql

target_url="$(printenv "$target_url_env" 2>/dev/null || true)"
ops_validate_database_url "$target_url"
production_url="${DATABASE_URL:-}"
[[ -z "$production_url" || "$target_url" != "$production_url" ]] \
  || ops_die "복원 대상 URL이 현재 DATABASE_URL과 같습니다. 운영 DB 복원을 거부합니다."
unset "$target_url_env" 2>/dev/null || true
unset DATABASE_URL 2>/dev/null || true

started_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
record_stamp="$(date -u +%Y%m%dT%H%M%SZ)"
phase="initialize"
backup_checksum="not_verified"
restored_user_objects="not_run"
fish_rows="not_run"
failed_flyway_migrations="not_run"
work_temp=""
record_temp=""
record_path="$record_dir/restore_drill_${record_stamp}_${target_database}_$$.record"

write_record_and_cleanup() {
  local exit_code=$?
  local status="FAIL"
  local completed_at
  local staged_record

  trap - EXIT
  set +e
  [[ $exit_code -eq 0 ]] && status="PASS"
  completed_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

  if [[ -n "$record_temp" ]]; then
    staged_record="$record_temp/drill.record"
    if ! {
      printf 'format=fishnote-restore-drill-v1\n'
      printf 'started_at_utc=%s\n' "$started_at"
      printf 'completed_at_utc=%s\n' "$completed_at"
      printf 'status=%s\n' "$status"
      printf 'exit_code=%s\n' "$exit_code"
      printf 'phase=%s\n' "$phase"
      printf 'backup=%s\n' "$(basename "$backup")"
      printf 'backup_sha256=%s\n' "$backup_checksum"
      printf 'target_database=%s\n' "$target_database"
      printf 'restored_public_objects=%s\n' "$restored_user_objects"
      printf 'fish_rows=%s\n' "$fish_rows"
      printf 'failed_flyway_migrations=%s\n' "$failed_flyway_migrations"
    } > "$staged_record"; then
      printf 'ERROR: restore drill 기록 내용을 쓰지 못했습니다.\n' >&2
      exit_code=1
    elif [[ -e "$record_path" ]] || ! mv "$staged_record" "$record_path"; then
      printf 'ERROR: restore drill 기록을 원자적으로 게시하지 못했습니다.\n' >&2
      exit_code=1
    else
      printf 'Drill record: %s\n' "$record_path"
    fi
  else
    printf 'ERROR: restore drill 기록 임시 디렉터리를 만들지 못했습니다.\n' >&2
    exit_code=1
  fi

  ops_cleanup_temp_dir "$work_dir" "$work_temp" ".fishnote-restore-drill"
  ops_cleanup_temp_dir "$record_dir" "$record_temp" ".fishnote-drill-record"
  exit "$exit_code"
}
trap 'exit 129' HUP
trap 'exit 130' INT
trap 'exit 143' TERM
trap write_record_and_cleanup EXIT

record_temp="$(mktemp -d "$record_dir/.fishnote-drill-record.XXXXXX")"
work_temp="$(mktemp -d "$work_dir/.fishnote-restore-drill.XXXXXX")"
chmod 700 "$record_temp" "$work_temp"

phase="verify_backup"
backup_checksum="$(ops_verify_checksum "$backup")"
decrypted_archive="$work_temp/fishnote.restore.dump"
ops_decrypt_backup "$backup" "$decrypted_archive" "$age_identity_file" "$gpg_home"
pg_restore --list "$decrypted_archive" >/dev/null

psql_target() {
  local sql="$1"
  PGDATABASE="$target_url" PGAPPNAME=fishnote_restore_drill PGCONNECT_TIMEOUT=15 \
    psql -X -A -t -q -v ON_ERROR_STOP=1 -c "$sql"
}

phase="validate_disposable_target"
actual_database="$(psql_target 'SELECT current_database();')"
[[ "$actual_database" == "$target_database" ]] \
  || ops_die "연결된 실제 DB 이름이 확인한 폐기 가능 대상과 다릅니다."

target_marker="$(psql_target "SELECT COALESCE(shobj_description(oid, 'pg_database'), '') FROM pg_database WHERE datname = current_database();")"
[[ "$target_marker" == "fishnote:disposable-restore-drill" ]] \
  || ops_die "대상 DB에 필수 폐기 가능 restore-drill comment가 없습니다."

read_only="$(psql_target "SELECT current_setting('transaction_read_only');")"
[[ "$read_only" == "off" ]] || ops_die "대상 DB가 read-only라 restore drill을 실행할 수 없습니다."

existing_objects="$(psql_target "SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relkind IN ('r','p','v','m','S','f');")"
[[ "$existing_objects" == "0" ]] \
  || ops_die "대상 public schema가 비어 있지 않습니다. 기존 데이터 덮어쓰기를 거부합니다."

phase="restore_single_transaction"
restore_error_log="$work_temp/restore.stderr"
if ! {
  pg_restore --exit-on-error --no-owner --no-privileges --file=- "$decrypted_archive" \
    | PGDATABASE="$target_url" PGAPPNAME=fishnote_restore_drill PGCONNECT_TIMEOUT=15 \
        psql -X -q -v ON_ERROR_STOP=1 --single-transaction
} 2> "$restore_error_log"; then
  ops_die "restore가 실패했습니다. 민감할 수 있는 상세 오류는 출력하지 않았고 임시 파일과 함께 제거합니다."
fi

phase="post_restore_validation"
restored_user_objects="$(psql_target "SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relkind IN ('r','p','v','m','S','f');")"
(( restored_user_objects > 0 )) || ops_die "restore 후 public schema 객체를 찾지 못했습니다."

fish_table_exists="$(psql_target "SELECT to_regclass('public.fish') IS NOT NULL;")"
flyway_table_exists="$(psql_target "SELECT to_regclass('public.flyway_schema_history') IS NOT NULL;")"
[[ "$fish_table_exists" == "t" && "$flyway_table_exists" == "t" ]] \
  || ops_die "restore 후 핵심 fish 또는 Flyway history 테이블이 없습니다."

failed_flyway_migrations="$(psql_target 'SELECT count(*) FROM public.flyway_schema_history WHERE NOT success;')"
[[ "$failed_flyway_migrations" == "0" ]] \
  || ops_die "restore된 DB에 실패 상태의 Flyway migration이 있습니다."
fish_rows="$(psql_target 'SELECT count(*) FROM public.fish;')"

phase="completed"
printf 'OK: isolated restore drill completed for %s.\n' "$target_database"
printf 'OK: restored_public_objects=%s fish_rows=%s failed_flyway_migrations=%s\n' \
  "$restored_user_objects" "$fish_rows" "$failed_flyway_migrations"
printf 'NOTICE: 검수와 기록 보존 후 대상 DB 폐기는 운영자가 별도 승인 절차로 수행해야 합니다.\n'
