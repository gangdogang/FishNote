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
  backup_postgres.sh \
    --output-dir /absolute/backup/path \
    --work-dir /absolute/protected/work/path \
    --age-recipient AGE_PUBLIC_RECIPIENT \
    --age-identity-file /absolute/path/to/age-identity

  backup_postgres.sh \
    --output-dir /absolute/backup/path \
    --work-dir /absolute/protected/work/path \
    --gpg-recipient GPG_KEY_ID \
    --gpg-homedir /absolute/scoped/gnupg-home

DATABASE_URL must be injected into this process by a secret manager and is
accepted only from the environment, so credentials are not put in this
script's command line or shell history. Exactly one encryption mode must be configured.
The private identity is required because every new encrypted artifact is
immediately decrypted and checked with pg_restore before publication.
USAGE
}

output_dir=""
work_dir="${BACKUP_WORK_DIR:-}"
age_recipient="${AGE_RECIPIENT:-}"
age_identity_file="${AGE_IDENTITY_FILE:-}"
gpg_recipient="${GPG_RECIPIENT:-}"
gpg_home="${GPG_HOME:-}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --output-dir) [[ $# -ge 2 ]] || ops_die "--output-dir 값이 필요합니다."; output_dir="$2"; shift 2 ;;
    --work-dir) [[ $# -ge 2 ]] || ops_die "--work-dir 값이 필요합니다."; work_dir="$2"; shift 2 ;;
    --age-recipient) [[ $# -ge 2 ]] || ops_die "--age-recipient 값이 필요합니다."; age_recipient="$2"; shift 2 ;;
    --age-identity-file) [[ $# -ge 2 ]] || ops_die "--age-identity-file 값이 필요합니다."; age_identity_file="$2"; shift 2 ;;
    --gpg-recipient) [[ $# -ge 2 ]] || ops_die "--gpg-recipient 값이 필요합니다."; gpg_recipient="$2"; shift 2 ;;
    --gpg-homedir) [[ $# -ge 2 ]] || ops_die "--gpg-homedir 값이 필요합니다."; gpg_home="$2"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) ops_die "알 수 없는 인자가 있습니다. --help로 사용법을 확인하세요." ;;
  esac
done

[[ -n "$output_dir" ]] || ops_die "--output-dir를 명시해야 합니다."
[[ -n "$work_dir" ]] || ops_die "--work-dir 또는 BACKUP_WORK_DIR을 명시해야 합니다."
ops_require_absolute_dir "백업 출력" "$output_dir"
ops_require_absolute_dir "보호된 작업" "$work_dir"

database_url="${DATABASE_URL:-}"
ops_validate_database_url "$database_url"
unset DATABASE_URL

if [[ -n "$age_recipient" || -n "$age_identity_file" ]]; then
  [[ -n "$age_recipient" && -n "$age_identity_file" ]] \
    || ops_die "age 모드는 recipient와 identity 파일을 모두 요구합니다."
  [[ -z "$gpg_recipient" && -z "$gpg_home" ]] \
    || ops_die "age와 GPG 모드를 동시에 사용할 수 없습니다."
  ops_require_command age
  ops_require_absolute_readable_file "age identity" "$age_identity_file"
  encryption_mode="age"
  extension="age"
else
  [[ -n "$gpg_recipient" && -n "$gpg_home" ]] \
    || ops_die "age 또는 GPG 암호화 설정을 명시해야 합니다."
  ops_require_command gpg
  ops_require_absolute_dir "GPG home" "$gpg_home"
  encryption_mode="gpg"
  extension="gpg"
fi

ops_require_command pg_dump
ops_require_command pg_restore

work_temp=""
publish_temp=""
lock_dir="$output_dir/.fishnote-backup.lock"
lock_acquired="false"
cleanup() {
  local exit_code=$?
  trap - EXIT
  ops_cleanup_temp_dir "$work_dir" "$work_temp" ".fishnote-backup-work"
  ops_cleanup_temp_dir "$output_dir" "$publish_temp" ".fishnote-backup-publish"
  if [[ "$lock_acquired" == "true" ]] && ! rmdir "$lock_dir"; then
    printf 'WARNING: 백업 lock 디렉터리를 제거하지 못했습니다.\n' >&2
    exit_code=1
  fi
  exit "$exit_code"
}
trap 'exit 129' HUP
trap 'exit 130' INT
trap 'exit 143' TERM
trap cleanup EXIT

mkdir "$lock_dir" 2>/dev/null \
  || ops_die "다른 백업 작업이 실행 중이거나 stale lock이 있습니다. 덮어쓰기를 거부합니다."
lock_acquired="true"
work_temp="$(mktemp -d "$work_dir/.fishnote-backup-work.XXXXXX")"
publish_temp="$(mktemp -d "$output_dir/.fishnote-backup-publish.XXXXXX")"
chmod 700 "$work_temp" "$publish_temp"

timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
backup_name="fishnote_${timestamp}.dump.${extension}"
final_backup="$output_dir/$backup_name"
final_checksum="${final_backup}.sha256"
raw_archive="$work_temp/fishnote.dump"
verified_archive="$work_temp/fishnote.verified.dump"
staged_backup="$publish_temp/$backup_name"
staged_checksum="$publish_temp/${backup_name}.sha256"

[[ ! -e "$final_backup" && ! -e "$final_checksum" ]] \
  || ops_die "같은 시각의 백업 파일이 이미 존재합니다. 덮어쓰지 않습니다."

# PGDATABASE may contain a libpq URI. Keeping it in the child environment
# avoids putting credentials in process arguments or diagnostic output.
PGDATABASE="$database_url" PGAPPNAME=fishnote_backup PGCONNECT_TIMEOUT=15 \
  pg_dump --format=custom --no-owner --no-privileges --file="$raw_archive"
pg_restore --list "$raw_archive" >/dev/null

if [[ "$encryption_mode" == "age" ]]; then
  age --encrypt --recipient "$age_recipient" --output "$staged_backup" "$raw_archive"
  age --decrypt --identity "$age_identity_file" \
    --output "$verified_archive" "$staged_backup"
else
  gpg --homedir "$gpg_home" --batch --yes --quiet --trust-model always \
    --recipient "$gpg_recipient" --output "$staged_backup" --encrypt "$raw_archive"
  gpg --homedir "$gpg_home" --batch --yes --quiet --pinentry-mode error \
    --output "$verified_archive" --decrypt "$staged_backup"
fi

[[ "$(ops_hash_file "$raw_archive")" == "$(ops_hash_file "$verified_archive")" ]] \
  || ops_die "암호화 후 복호화한 archive가 원본과 일치하지 않습니다."
pg_restore --list "$verified_archive" >/dev/null

encrypted_checksum="$(ops_hash_file "$staged_backup")"
printf '%s  %s\n' "$encrypted_checksum" "$backup_name" > "$staged_checksum"

# The artifact is the completion marker: publish its checksum first, then move
# the encrypted archive atomically on the same filesystem.
mv "$staged_checksum" "$final_checksum"
mv "$staged_backup" "$final_backup"

printf 'OK: encrypted PostgreSQL backup published: %s\n' "$final_backup"
printf 'OK: SHA-256 and decrypt/pg_restore verification completed.\n'
