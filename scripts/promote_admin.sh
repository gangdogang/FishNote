#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 1 || -z "${1// }" ]]; then
  echo "사용법: DATABASE_URL=<postgres-url> $0 <가입한 이메일>" >&2
  exit 2
fi

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL 환경변수가 필요합니다." >&2
  exit 2
fi

admin_email="$1"
updated_id="$(
  psql "$DATABASE_URL" \
    --no-psqlrc \
    --set=ON_ERROR_STOP=1 \
    --set=admin_email="$admin_email" \
    --quiet \
    --tuples-only \
    --no-align \
    --command="UPDATE users SET role = 'ADMIN' WHERE lower(email) = lower(:'admin_email') RETURNING id"
)"

updated_id="${updated_id//[[:space:]]/}"
if [[ -z "$updated_id" ]]; then
  echo "해당 이메일의 가입 계정을 찾지 못했습니다: $admin_email" >&2
  exit 1
fi

echo "관리자 승격 완료: user_id=$updated_id email=$admin_email"
