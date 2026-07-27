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
  check_recent_backup.sh \
    --backup-dir /absolute/backup/path \
    --work-dir /absolute/protected/work/path \
    [--max-age-hours 24] \
    --age-identity-file /absolute/path/to/age-identity

For GPG artifacts, replace --age-identity-file with:
    --gpg-homedir /absolute/scoped/gnupg-home

The newest FishNote artifact must be no older than 24 hours (or a stricter
1..24 hour value), have a matching SHA-256 sidecar, decrypt successfully, and
be readable by pg_restore.
USAGE
}

backup_dir=""
work_dir="${BACKUP_WORK_DIR:-}"
max_age_hours="24"
age_identity_file="${AGE_IDENTITY_FILE:-}"
gpg_home="${GPG_HOME:-}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --backup-dir) [[ $# -ge 2 ]] || ops_die "--backup-dir 값이 필요합니다."; backup_dir="$2"; shift 2 ;;
    --work-dir) [[ $# -ge 2 ]] || ops_die "--work-dir 값이 필요합니다."; work_dir="$2"; shift 2 ;;
    --max-age-hours) [[ $# -ge 2 ]] || ops_die "--max-age-hours 값이 필요합니다."; max_age_hours="$2"; shift 2 ;;
    --age-identity-file) [[ $# -ge 2 ]] || ops_die "--age-identity-file 값이 필요합니다."; age_identity_file="$2"; shift 2 ;;
    --gpg-homedir) [[ $# -ge 2 ]] || ops_die "--gpg-homedir 값이 필요합니다."; gpg_home="$2"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) ops_die "알 수 없는 인자가 있습니다. --help로 사용법을 확인하세요." ;;
  esac
done

[[ -n "$backup_dir" ]] || ops_die "--backup-dir를 명시해야 합니다."
[[ -n "$work_dir" ]] || ops_die "--work-dir 또는 BACKUP_WORK_DIR을 명시해야 합니다."
ops_require_absolute_dir "백업" "$backup_dir"
ops_require_absolute_dir "보호된 작업" "$work_dir"
[[ "$max_age_hours" =~ ^[0-9]+$ ]] \
  || ops_die "--max-age-hours는 1~24의 정수여야 합니다."
(( max_age_hours >= 1 && max_age_hours <= 24 )) \
  || ops_die "--max-age-hours는 1~24만 허용합니다."

newest_backup=""
newest_epoch=0
for candidate in "$backup_dir"/fishnote_*.dump.age "$backup_dir"/fishnote_*.dump.gpg; do
  [[ -f "$candidate" ]] || continue
  candidate_epoch="$(ops_backup_timestamp_epoch "$(basename "$candidate")")"
  if (( candidate_epoch > newest_epoch )); then
    newest_epoch="$candidate_epoch"
    newest_backup="$candidate"
  fi
done
[[ -n "$newest_backup" ]] || ops_die "FishNote 암호화 백업을 찾지 못했습니다."
ops_validate_backup_basename "$(basename "$newest_backup")"

now_epoch="$(date +%s)"
age_seconds=$(( now_epoch - newest_epoch ))
mtime_epoch="$(ops_file_epoch "$newest_backup")"
mtime_age_seconds=$(( now_epoch - mtime_epoch ))
(( age_seconds >= -300 )) || ops_die "최신 백업의 파일명 UTC 시각이 현재보다 5분 이상 미래입니다. 시계를 확인하세요."
(( age_seconds <= max_age_hours * 3600 )) \
  || ops_die "최신 백업이 허용된 최대 보관 시각보다 오래되었습니다."
(( mtime_age_seconds >= -300 )) || ops_die "최신 백업의 filesystem 수정 시각이 현재보다 5분 이상 미래입니다."
(( mtime_age_seconds <= max_age_hours * 3600 )) \
  || ops_die "최신 백업의 filesystem 수정 시각이 허용된 범위보다 오래되었습니다."

case "$newest_backup" in
  *.dump.age)
    [[ -z "$gpg_home" ]] || ops_die "age 백업 검증에 GPG home을 함께 지정할 수 없습니다."
    ops_require_absolute_readable_file "age identity" "$age_identity_file"
    ;;
  *.dump.gpg)
    [[ -z "$age_identity_file" ]] || ops_die "GPG 백업 검증에 age identity를 함께 지정할 수 없습니다."
    ops_require_absolute_dir "GPG home" "$gpg_home"
    ;;
esac

ops_require_command pg_restore
verified_checksum="$(ops_verify_checksum "$newest_backup")"

work_temp=""
cleanup() {
  local exit_code=$?
  trap - EXIT
  ops_cleanup_temp_dir "$work_dir" "$work_temp" ".fishnote-backup-check"
  exit "$exit_code"
}
trap 'exit 129' HUP
trap 'exit 130' INT
trap 'exit 143' TERM
trap cleanup EXIT

work_temp="$(mktemp -d "$work_dir/.fishnote-backup-check.XXXXXX")"
chmod 700 "$work_temp"
verified_archive="$work_temp/fishnote.verified.dump"
ops_decrypt_backup "$newest_backup" "$verified_archive" "$age_identity_file" "$gpg_home"
pg_restore --list "$verified_archive" >/dev/null

printf 'OK: recent backup verified: %s\n' "$newest_backup"
printf 'OK: age_seconds=%s mtime_age_seconds=%s sha256=%s\n' \
  "$age_seconds" "$mtime_age_seconds" "$verified_checksum"
