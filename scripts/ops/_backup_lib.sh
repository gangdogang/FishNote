#!/usr/bin/env bash

# Shared helpers for FishNote backup/restore scripts. This file is sourced by
# the executable scripts in this directory.

ops_die() {
  printf 'ERROR: %s\n' "$*" >&2
  exit 1
}

ops_require_command() {
  command -v "$1" >/dev/null 2>&1 || ops_die "필수 명령을 찾을 수 없습니다: $1"
}

ops_require_absolute_dir() {
  local label="$1"
  local directory="$2"

  case "$directory" in
    /*) ;;
    *) ops_die "$label 경로는 절대 경로여야 합니다." ;;
  esac
  [[ -d "$directory" ]] || ops_die "$label 디렉터리가 존재하지 않습니다."
  [[ -w "$directory" ]] || ops_die "$label 디렉터리에 쓸 수 없습니다."
}

ops_require_absolute_readable_file() {
  local label="$1"
  local file="$2"

  case "$file" in
    /*) ;;
    *) ops_die "$label 경로는 절대 경로여야 합니다." ;;
  esac
  [[ -f "$file" && -r "$file" ]] || ops_die "$label 파일을 읽을 수 없습니다."
}

ops_validate_database_url() {
  local value="$1"

  [[ -n "$value" ]] || ops_die "DATABASE_URL이 비어 있습니다. 비밀 저장소에서 환경변수로 주입하세요."
  case "$value" in
    postgres://*|postgresql://*) ;;
    *) ops_die "DATABASE_URL은 postgres:// 또는 postgresql:// URI여야 합니다." ;;
  esac
  case "$value" in
    *$'\n'*|*$'\r'*) ops_die "DATABASE_URL에 줄바꿈을 사용할 수 없습니다." ;;
  esac
}

ops_hash_file() {
  local file="$1"

  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$file" | awk '{print $1}'
  elif command -v shasum >/dev/null 2>&1; then
    shasum -a 256 "$file" | awk '{print $1}'
  else
    ops_die "SHA-256 검증에 sha256sum 또는 shasum이 필요합니다."
  fi
}

ops_file_epoch() {
  local file="$1"

  if stat -f '%m' "$file" >/dev/null 2>&1; then
    stat -f '%m' "$file"
  else
    stat -c '%Y' "$file"
  fi
}

ops_backup_timestamp_epoch() {
  local name="$1"
  local stamp=""

  ops_validate_backup_basename "$name"
  stamp="${name#fishnote_}"
  stamp="${stamp%%.dump.*}"

  if date -u -j -f '%Y%m%dT%H%M%SZ' "$stamp" '+%s' >/dev/null 2>&1; then
    date -u -j -f '%Y%m%dT%H%M%SZ' "$stamp" '+%s'
  elif date -u -d "$stamp" '+%s' >/dev/null 2>&1; then
    date -u -d "$stamp" '+%s'
  else
    ops_die "백업 파일명의 UTC 시각을 해석할 수 없습니다."
  fi
}

ops_validate_backup_basename() {
  local name="$1"

  [[ "$name" =~ ^fishnote_[0-9]{8}T[0-9]{6}Z\.dump\.(age|gpg)$ ]] \
    || ops_die "FishNote 백업 파일명 규칙과 일치하지 않습니다."
}

ops_verify_checksum() {
  local backup="$1"
  local checksum_file="${backup}.sha256"
  local expected=""
  local recorded_name=""
  local extra=""
  local actual=""

  [[ -f "$checksum_file" && -r "$checksum_file" ]] \
    || ops_die "백업 checksum 파일이 없거나 읽을 수 없습니다."

  read -r expected recorded_name extra < "$checksum_file" \
    || ops_die "백업 checksum 파일 형식이 올바르지 않습니다."
  [[ -z "$extra" && ${#expected} -eq 64 ]] \
    || ops_die "백업 checksum 파일 형식이 올바르지 않습니다."
  case "$expected" in
    *[!0-9a-fA-F]*) ops_die "백업 checksum이 SHA-256 형식이 아닙니다." ;;
  esac
  [[ "$recorded_name" == "$(basename "$backup")" ]] \
    || ops_die "checksum이 가리키는 백업 파일명이 일치하지 않습니다."

  actual="$(ops_hash_file "$backup")"
  [[ "$actual" == "$expected" ]] || ops_die "암호화 백업의 SHA-256 checksum이 일치하지 않습니다."
  printf '%s\n' "$actual"
}

ops_decrypt_backup() {
  local backup="$1"
  local output="$2"
  local age_identity_file="$3"
  local gpg_home="$4"

  case "$backup" in
    *.dump.age)
      ops_require_command age
      ops_require_absolute_readable_file "age identity" "$age_identity_file"
      age --decrypt --identity "$age_identity_file" --output "$output" "$backup"
      ;;
    *.dump.gpg)
      ops_require_command gpg
      ops_require_absolute_dir "GPG home" "$gpg_home"
      gpg --homedir "$gpg_home" --batch --yes --quiet --pinentry-mode error \
        --output "$output" --decrypt "$backup"
      ;;
    *)
      ops_die "지원하지 않는 백업 확장자입니다. .dump.age 또는 .dump.gpg만 허용합니다."
      ;;
  esac
}

ops_cleanup_temp_dir() {
  local parent="$1"
  local temp="$2"
  local prefix="$3"

  [[ -n "$temp" ]] || return 0
  case "$temp" in
    "$parent"/"$prefix".*)
      rm -rf -- "$temp"
      ;;
    *)
      printf 'WARNING: 안전 범위를 벗어난 임시 경로는 삭제하지 않았습니다.\n' >&2
      ;;
  esac
}
