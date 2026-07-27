#!/usr/bin/env bash
set -euo pipefail

usage() {
  printf '%s\n' \
    "Usage:" \
    "  scripts/ops/quarantine_icloud_conflicts.sh" \
    "  scripts/ops/quarantine_icloud_conflicts.sh --apply --quarantine-dir /absolute/path" \
    "  scripts/ops/quarantine_icloud_conflicts.sh --apply --resume --quarantine-dir /absolute/path"
}

apply=false
resume=false
quarantine_dir=""

while [ "$#" -gt 0 ]; do
  case "$1" in
    --apply)
      apply=true
      shift
      ;;
    --resume)
      resume=true
      shift
      ;;
    --quarantine-dir)
      [ "$#" -ge 2 ] || {
        usage >&2
        exit 2
      }
      quarantine_dir=$2
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      printf 'Unknown argument: %s\n' "$1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

repo_root=$(git rev-parse --show-toplevel)
candidate_file=$(mktemp "${TMPDIR:-/tmp}/fishnote-icloud-conflicts.XXXXXX")
manifest_source=$(mktemp "${TMPDIR:-/tmp}/fishnote-icloud-manifest.XXXXXX")
trap 'rm -f "$candidate_file" "$manifest_source"' EXIT

count=0
while IFS= read -r -d '' relative_path; do
  filename=${relative_path##*/}
  case "$filename" in
    *" 2."*)
      ;;
    *)
      continue
      ;;
  esac

  prefix=${filename% 2.*}
  extension=${filename##*.}
  if [ "$prefix" = "$filename" ] || [ "$extension" = "$filename" ]; then
    printf 'Refusing ambiguous conflict name: %s\n' "$relative_path" >&2
    exit 1
  fi

  if [ "$relative_path" = "$filename" ]; then
    original_path="${prefix}.${extension}"
  else
    original_path="${relative_path%/*}/${prefix}.${extension}"
  fi

  if ! git -C "$repo_root" ls-files --error-unmatch -- "$original_path" >/dev/null 2>&1; then
    printf 'Refusing untracked conflict without a tracked original: %s\n' "$relative_path" >&2
    exit 1
  fi
  if [ ! -e "$repo_root/$original_path" ]; then
    printf 'Refusing conflict whose tracked original is missing: %s\n' "$relative_path" >&2
    exit 1
  fi

  printf '%s\0' "$relative_path" >>"$candidate_file"
  printf '%s\t%s\n' "$relative_path" "$original_path" >>"$manifest_source"
  count=$((count + 1))
done < <(git -C "$repo_root" ls-files --others --exclude-standard -z)

printf 'Validated %d iCloud conflict copies with tracked originals.\n' "$count"

if [ "$apply" != true ]; then
  printf '%s\n' "Dry run only. No files were moved."
  exit 0
fi

if [ "$count" -eq 0 ]; then
  printf '%s\n' "Nothing to quarantine."
  exit 0
fi
if [ -z "$quarantine_dir" ] || [ "${quarantine_dir#/}" = "$quarantine_dir" ]; then
  printf '%s\n' "--quarantine-dir must be an absolute path." >&2
  exit 2
fi

case "$quarantine_dir/" in
  "$repo_root/"*)
    printf '%s\n' "Quarantine directory must be outside the Git repository." >&2
    exit 2
    ;;
esac

if [ -e "$quarantine_dir" ] && [ "$resume" != true ]; then
  printf 'Refusing to reuse an existing quarantine directory: %s\n' "$quarantine_dir" >&2
  exit 1
fi

if [ "$resume" = true ]; then
  if [ ! -f "$quarantine_dir/manifest.tsv" ] || [ ! -d "$quarantine_dir/files" ]; then
    printf 'Cannot resume an incomplete quarantine directory: %s\n' "$quarantine_dir" >&2
    exit 1
  fi
  if ! grep -Fqx "source_repository	$repo_root" "$quarantine_dir/manifest.tsv"; then
    printf 'Quarantine manifest belongs to a different repository: %s\n' "$quarantine_dir" >&2
    exit 1
  fi
else
  mkdir -p "$quarantine_dir/files"
  {
    printf 'source_repository\t%s\n' "$repo_root"
    printf 'created_utc\t%s\n' "$(date -u '+%Y-%m-%dT%H:%M:%SZ')"
    printf 'conflict_count\t%d\n' "$count"
    printf '%s\n' "conflict_path	tracked_original"
    command cat "$manifest_source"
  } >"$quarantine_dir/manifest.tsv"
fi

moved=0
while IFS= read -r -d '' relative_path; do
  destination="$quarantine_dir/files/$relative_path"
  mkdir -p "$(dirname "$destination")"
  if [ -e "$destination" ]; then
    printf 'Refusing to overwrite quarantine destination: %s\n' "$destination" >&2
    exit 1
  fi
  attempt=1
  while ! mv "$repo_root/$relative_path" "$destination"; do
    if [ ! -e "$repo_root/$relative_path" ] && [ -e "$destination" ]; then
      break
    fi
    if [ "$attempt" -ge 3 ]; then
      printf 'Move failed after %d attempts: %s\n' "$attempt" "$relative_path" >&2
      exit 1
    fi
    attempt=$((attempt + 1))
    sleep 1
  done
  moved=$((moved + 1))
done <"$candidate_file"

printf 'Moved %d conflict copies to %s\n' "$moved" "$quarantine_dir"
printf '%s\n' "No tracked files were changed or deleted."
