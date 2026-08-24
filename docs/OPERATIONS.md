# FishNote 운영·백업·복구 런북

이 문서는 FishNote 배포, 상태 확인, PostgreSQL 백업, 월간 복원 훈련과 장애 시 롤백 기준을 정의한다. 명령은 예시이며 운영 DB나 클라우드 자원을 자동 생성·삭제하지 않는다. 실제 실행 전 대상 환경과 비밀 주입 경로를 두 사람이 확인한다.

## 1. 복구할 수 있는 것과 없는 것

Neon PostgreSQL은 단순 캐시가 아니라 다음 데이터의 원본이다.

- 회원, OAuth 연결, 북마크
- 익명·회원 후기, 도움돼요 투표, 후기 이미지와 DB 자산의 연결 상태
- 시세 관측값과 import dedup/audit 상태
- 출처, 오류 제보, review stat 등 운영 중 생성·갱신되는 데이터

Git의 코드·Flyway migration·seed는 스키마와 기준 catalog만 재생성한다. Cloudinary 원본은 이미지 바이트만 보관하며 어떤 후기·사용자·자산 상태에 연결되는지는 복구하지 못한다. 따라서 **코드와 Cloudinary만으로 Neon의 회원·후기·북마크·시세 데이터를 재구성할 수 없다.** Neon의 PITR/스냅샷 정책을 유지하면서, 별도로 매일 암호화한 논리 백업을 보관한다.

백업은 재해 복구 수단이지 애플리케이션 배포 롤백 수단이 아니다. 배포 실패 때 운영 DB 위에 과거 dump를 복원하면 정상 유입된 신규 데이터가 사라지므로 금지한다.

## 2. 도구와 비밀 관리 전제

운영 runner에는 다음을 준비한다.

1. 운영 PostgreSQL과 같은 major 또는 호환되는 더 최신 버전의 `pg_dump`, `pg_restore`, `psql`
2. 기본 권장 도구인 `age`, 또는 대안인 GnuPG 2.x
3. mode `0700`의 로컬 작업 디렉터리와 접근 제어된 백업·drill-record 디렉터리
4. scheduler/service manager가 환경변수로 주입하는 `DATABASE_URL`; URI를 crontab, 셸 인자, 저장소, 로그에 직접 쓰지 않는다.
5. 원격·다른 장애 도메인의 보관소와 보존 정책. 이 저장소의 스크립트는 검증된 백업을 자동 삭제하지 않는다.

`age`는 공개 recipient와 복호화 가능한 identity 파일을 모두 요구한다. identity는 저장소 밖의 mode `0600` 파일로 두고 접근을 backup runner에만 허용한다. GPG를 쓰면 전용 `--gpg-homedir`에 recipient 공개키와 검증용 비밀키가 있어야 하며, 예약 실행 중 pinentry가 뜨지 않도록 GPG agent 정책을 사전에 검증한다. 비밀키 접근이 없는 별도 백업 writer를 원하면 writer와 검증 job을 분리하되, 24시간 안에 identity를 가진 격리 runner에서 실제 복호화 검증을 완료해야 한다.

복호화된 dump는 `--work-dir` 아래 mode `0700` 임시 디렉터리에만 존재하며 종료 시 제거된다. SSD의 secure erase를 보장하는 것은 아니므로 work directory 자체도 암호화된 볼륨에 둔다.

## 3. 매일 암호화 백업과 24시간 검증

### 3.1 age 권장 경로

service manager가 `DATABASE_URL`을 해당 프로세스에만 주입한 뒤 다음을 실행한다.

```bash
scripts/ops/backup_postgres.sh \
  --output-dir /srv/fishnote-backups \
  --work-dir /var/lib/fishnote-backup/work \
  --age-recipient 'age1...' \
  --age-identity-file /run/secrets/fishnote-backup-age-key
```

스크립트는 다음 순서로 동작한다.

1. `pg_dump --format=custom --no-owner --no-privileges`로 보호된 임시 공간에 archive를 만든다.
2. archive 목록을 읽어 custom format 손상을 확인한다.
3. `age`로 암호화하고 즉시 다시 복호화한다.
4. 원본/복호화본 SHA-256 일치와 `pg_restore --list` 성공을 확인한다.
5. 암호화 파일의 SHA-256 sidecar를 먼저, 암호화 artifact를 마지막 completion marker로 같은 filesystem에서 원자적으로 게시한다.

그 직후 또는 별도 감시 job에서 아래 검사를 실행한다.

```bash
scripts/ops/check_recent_backup.sh \
  --backup-dir /srv/fishnote-backups \
  --work-dir /var/lib/fishnote-backup/work \
  --max-age-hours 24 \
  --age-identity-file /run/secrets/fishnote-backup-age-key
```

최신 artifact의 파일명 UTC 시각과 filesystem 수정 시각 중 하나라도 24시간보다 오래됐거나, 시계가 5분 이상 미래이거나, checksum/복호화/custom archive 검증 중 하나라도 실패하면 exit code가 0이 아니다. 단순히 오래된 파일을 `touch`해도 파일명 시각 검사를 우회할 수 없다. scheduler는 실패를 즉시 경보로 연결한다. 성공 로그에는 파일 경로, 나이, checksum만 남고 접속 URI나 DB payload는 남기지 않는다. 동시 backup writer는 출력 디렉터리의 원자적 lock으로 거부하며, 비정상 종료로 stale lock이 남았다면 실행 중인 writer가 없음을 확인한 뒤 운영자가 제거한다.

### 3.2 GPG 대안

```bash
scripts/ops/backup_postgres.sh \
  --output-dir /srv/fishnote-backups \
  --work-dir /var/lib/fishnote-backup/work \
  --gpg-recipient 'FINGERPRINT_OR_KEY_ID' \
  --gpg-homedir /var/lib/fishnote-backup/gnupg

scripts/ops/check_recent_backup.sh \
  --backup-dir /srv/fishnote-backups \
  --work-dir /var/lib/fishnote-backup/work \
  --max-age-hours 24 \
  --gpg-homedir /var/lib/fishnote-backup/gnupg
```

백업 성공은 로컬 생성만을 뜻하지 않는다. 다른 장애 도메인으로 전송된 객체의 checksum과 보존 정책까지 별도 모니터링한다. 최소 주 1회 최근 7일의 일별 artifact가 모두 존재하는지도 확인한다.

## 4. 월 1회 격리 restore drill

### 4.1 대상 DB 준비 규칙

복원 대상은 운영 DB와 분리된 프로젝트/브랜치 또는 격리 cluster에 운영자가 미리 만든 빈 DB여야 한다. 이름은 반드시 다음 형식이다.

```text
fishnote_restore_drill_YYYYMMDD_suffix
```

대상 DB에 연결해 다음 comment를 한 번 설정한다. 이 작업은 대상 이름과 격리 위치를 재확인한 뒤 수행한다.

```sql
COMMENT ON DATABASE fishnote_restore_drill_YYYYMMDD_suffix
  IS 'fishnote:disposable-restore-drill';
```

스크립트는 아래 조건을 모두 만족하지 않으면 복원을 시작하지 않는다.

- 명시한 환경변수에서만 대상 URL을 읽으며 현재 `DATABASE_URL`과 동일하면 거부
- 실제 `current_database()`가 `--target-database`와 정확히 일치
- 엄격한 disposable 이름과 `DISPOSABLE:<name>` 확인 문자열 일치
- database comment가 `fishnote:disposable-restore-drill`과 정확히 일치
- `public` schema에 기존 table/view/sequence가 0개
- target이 writable

`--clean`, `--create`, `dropdb`, 운영 DB 덮어쓰기는 사용하지 않는다. SQL은 `psql --single-transaction`으로 적용하므로 restore 단계 실패 시 전체 transaction이 rollback된다.

### 4.2 실행과 기록

대상 URL은 예를 들어 `FISHNOTE_RESTORE_TARGET_URL`이라는 scheduler-scoped secret으로 주입한다. URL 자체를 명령행에 쓰지 않는다.

```bash
scripts/ops/restore_drill.sh \
  --backup /srv/fishnote-backups/fishnote_20260723T000000Z.dump.age \
  --work-dir /var/lib/fishnote-backup/work \
  --record-dir /var/lib/fishnote-backup/drill-records \
  --target-url-env FISHNOTE_RESTORE_TARGET_URL \
  --target-database fishnote_restore_drill_20260723_a1b2 \
  --confirm-disposable-target DISPOSABLE:fishnote_restore_drill_20260723_a1b2 \
  --age-identity-file /run/secrets/fishnote-backup-age-key
```

drill은 암호화 artifact의 checksum과 복호화를 다시 검증한 후 restore한다. 완료 후 `fish`, `flyway_schema_history`, 실패 migration 0건과 public 객체 수를 검사한다. 성공/실패 여부, 실패 phase, backup basename/checksum, 대상 DB 이름, 핵심 검증 수치를 credential 없는 원자적 `.record` 파일로 남긴다. 상세 restore stderr는 후기·회원 데이터가 포함될 가능성을 고려해 터미널에 출력하지 않고 보호된 임시 공간과 함께 제거한다.

성공 후 다음도 사람이 확인한다.

1. 격리된 BE를 복원 DB에 연결해 `ddl-auto=validate`와 Flyway validation 성공
2. 익명 후기, 회원 후기, 북마크, 시세의 표본 개수와 참조 무결성
3. `/actuator/health/readiness`가 `UP`이고 핵심 read API가 정상
4. drill record를 보존 정책에 따라 운영 증적으로 저장
5. 승인받은 별도 절차로 disposable DB 폐기. restore 스크립트는 DB를 자동 삭제하지 않는다.

drill 실패 시 대상을 재사용하거나 `--clean`으로 덮지 않는다. record를 보존하고 원인을 수정한 뒤 새 이름의 빈 disposable DB로 재실행한다.

## 5. 상태 확인과 관측

- liveness: `GET /actuator/health/liveness`. JVM process가 살아 있는지만 판단한다.
- readiness: `GET /actuator/health/readiness`. DB health가 포함되므로 배포 트래픽 진입과 migration 후 확인에 사용한다.
- legacy `/api/v1/health`는 liveness 안내용일 뿐 DB readiness로 사용하지 않는다.
- health 상세를 공개하지 않고 HTTP status와 `UP`/`DOWN`만 감시한다.

배포 전후 endpoint latency, 5xx, DB pool acquisition timeout, SQL count sample, Caffeine hit/miss, rate-limit cache cardinality, 외부 Telegram/Cloudinary timeout을 확인한다. trace ID는 상관관계에만 사용하고 token, cookie, 접속 URI, 후기 원문, 이메일, nickname, 이미지 payload를 metric tag나 일반 로그에 넣지 않는다. 무료 인프라 cold start는 warm p95와 분리한다.

## 6. 점진 배포 순서와 feature flag

배포 단위는 다음 순서를 지킨다.

1. 최근 24시간 백업과 최신 restore drill PASS 확인
2. 운영 snapshot 복제본에서 migration dry-run, lock/예상 시간 확인
3. additive/expand migration 배포
4. 구 API와 호환되는 BE dual-write·신규 endpoint 배포; 신규 FE read는 아직 사용하지 않음
5. liveness/readiness, 오류율, migration 상태 확인
6. backfill 실행 후 row count, orphan, aggregate 일치 검증
7. `SPRING_FLYWAY_TARGET=17`로 V16 hash enforce와 V17 price CHECK까지만 적용
8. staging/canary에서 read flag를 한 개씩 켜고 `/api/v1` fallback 유지
9. FE를 home/v2/media/source/slug read로 전환
10. bounded cache를 마지막에 활성화하고 hit ratio·DB 부하·staleness 확인
11. Analytics/prerender/sitemap 배포
12. 최소 한 안정화 release 뒤 `SPRING_FLYWAY_TARGET` 제한을 제거해 V18 legacy contract 제거

BE switch는 `REVIEW_STAT_READ_MODEL_ENABLED`, `CATALOG_V2_ENABLED`,
`PRICE_IMPORT_BULK_ENABLED`, `SOURCES_ENABLED`, `PUBLIC_CACHE_ENABLED`에 wiring되어 있다. false이면 각각
live aggregate, v2 `FEATURE_DISABLED`, 최대 50행 legacy import, source `FEATURE_DISABLED`,
NoOp cache+HTTP no-store로 fallback한다. FE는 `VITE_CATALOG_V2_ENABLED`와
`VITE_REVIEW_V2_ENABLED`로 v2 read를 제어하며, 활성 상태에서도 v2 네트워크 오류·404·5xx·503 또는
비정상 payload면 bounded v1 요청으로 되돌아간다. DB migration만으로 신규 read path를 즉시 강제하지 않는다.

각 flag 전환은 변경 시각, 담당자, 이전/이후 값, 관찰 지표와 되돌림 기준을 배포 기록에 남긴다.

## 7. 캐시 장애와 롤백

FishNote의 Caffeine cache는 process-local 최적화이며 source of truth가 아니다. cache get/put/evict 오류는 공개 catalog/detail/price 조회에서 DB로 fail-open해야 한다. 단, DB도 실패하면 readiness를 내리고 정상 응답처럼 위장하지 않는다. 사용자별 `mine`, `viewerHelpful`, review/auth/bookmark 응답은 `private, no-store`이고 public CDN cache에 저장하지 않는다.

가격 import와 review mutation의 DB commit이 우선이다. after-commit cache eviction이나 Telegram reply 실패 때문에 이미 commit된 transaction을 rollback하지 않는다. 짧은 HTTP TTL로 수렴시키고 실패 metric을 경보한다. 여러 인스턴스에서는 Caffeine eviction이 다른 인스턴스로 전파되지 않으므로 TTL 수렴을 전제로 하거나 명시적 distributed invalidation을 추가한다.

장애 시 되돌림 순서는 다음과 같다.

1. 신규 FE read를 `/api/v1`/legacy ID·media fallback으로 전환하거나 직전 FE release로 rollback
2. `REVIEW_STAT_READ_MODEL_ENABLED=false` 등 실제로 존재하는 read flag를 OFF
3. cache를 bypass/restart해 DB direct read로 전환하고 DB 부하를 함께 감시
4. bulk importer가 문제면 신규 import 유입을 일시 중단한 뒤 검증된 legacy 경로를 제한된 row limit으로 사용
5. BE는 additive schema를 이해하는 직전 호환 version으로 rollback 가능하지만, contract migration 뒤에는 구 version을 배포하지 않음
6. Flyway migration은 down/파일 수정/체크섬 변경으로 되돌리지 않고 새 forward-fix migration을 추가

contract migration은 구 앱 rollback이 필요 없다는 것이 확인된 뒤에만 적용한다. migration 실패, backfill 불일치, cache staleness는 각각 애플리케이션/flag 롤백과 forward fix로 처리하며 운영 DB를 과거 dump로 덮지 않는다. 데이터 재해 복구가 실제로 필요한 경우에만 별도 사고 지휘·쓰기 중단·복구 시점 합의 후 Neon PITR 또는 검증된 backup을 **새 DB에** 복원하고 cutover한다.

## 8. 스크립트 자체 검증

DB나 클라우드에 접속하지 않는 문법·정적 안전 검사는 다음과 같다.

```bash
scripts/ops/self_check.sh
```

이 검사는 Bash 문법, custom-format dump, 24시간 기본값, single-transaction restore, disposable marker와 금지된 destructive 옵션 부재를 확인한다. 실제 백업/복원 검증을 대체하지 않는다.

## 9. iCloud 충돌 복사본 격리

소스 저장소를 iCloud가 동기화하는 Desktop/Documents 아래에 두면 `Foo 2.java` 같은 충돌
복사본이 생겨 Java 중복 class 오류와 FE lint 잡음을 만들 수 있다. `.gitignore`로 숨기지 말고
저장소를 iCloud 밖으로 옮긴다. 이동 전에는 아래 dry-run으로 모든 충돌본에 Git이 추적하는
원본이 존재하는지 검증한다.

```bash
scripts/ops/quarantine_icloud_conflicts.sh
```

검증 후에는 저장소 밖의 새 디렉터리를 지정해 삭제 없이 격리한다. 스크립트는 기존 격리
디렉터리를 재사용하거나 파일을 덮어쓰지 않으며, 원래 상대 경로와 추적 원본의 대응표를
`manifest.tsv`로 남긴다.

```bash
scripts/ops/quarantine_icloud_conflicts.sh \
  --apply \
  --quarantine-dir /absolute/path/FishBook-iCloud-conflicts-YYYYMMDD
```

격리 후 tracked checkout에서 전체 검증을 통과시키고, 새 clone을 iCloud 밖에서 사용한다.
격리본은 최소 7일 보관한 뒤 manifest와 Git 이력을 대조하고 사람이 휴지통 이동 여부를
결정한다. 스크립트는 격리본을 자동 삭제하지 않는다.

## 10. 대표 이미지·출처 링크 점검

배포 전 또는 월 1회, manifest에 기록한 대표 이미지와 원문 페이지가 실제로 응답하는지 확인한다.
외부 호스트 상태에 따라 일시 실패할 수 있으므로 실패 URL을 브라우저에서 재확인한 뒤 교체 여부를 결정한다.

```bash
node scripts/ops/check_fish_media_urls.mjs
```

검사는 26개 이미지가 이미지 MIME 타입으로 응답하는지, 26개 출처 페이지가 성공 상태로
응답하는지를 확인한다. crop과 어종 식별의 적절성은 별도의 사람 검수를 대체하지 않는다.

## 11. 무료 티어 예산과 DB 유휴 정책

이 서비스는 전부 무료 티어 위에서 돈다. 무료 티어의 제약은 성능이 아니라 **한도**이고,
한도를 넘기면 성능이 나빠지는 게 아니라 **서비스가 정지한다**. 특히 Neon은 compute time을
초과하면 Postgres가 인증 단계에서 연결을 거부하므로, 애플리케이션은 Flyway migrate에서
실패해 기동조차 못 한다.

### 11.1 한도

| 서비스 | 플랜 | 한도 | 초과 시 |
| --- | --- | --- | --- |
| Neon | Free | **100 compute hours / 프로젝트 / 월** (매월 1일 리셋) | Postgres 연결 거부 → 앱 기동 실패 |
| Render | Free | 512MB RAM, 15분 무접속 시 spin down | 첫 요청 50초+ 지연. 메모리·CPU 지표는 유료 전용 |
| UptimeRobot | Free | 5분 간격 체크 | — |

Neon의 scale-to-zero는 **5분**이다. 이 숫자가 아래 규칙의 근거다.

### 11.2 DB를 깨우는 것을 전부 파악하고 있을 것

무료 예산이 터지는 경로는 트래픽이 아니라 **주기적으로 DB를 두드리는 자동화**다.
5분보다 짧은 간격으로 DB에 접근하는 것이 하나라도 있으면 compute는 영구히 깨어 있고
월 720시간을 소비한다. 10분 간격이어도 가동률 50%(월 약 360시간)로 한도를 넘긴다.

현재 DB를 깨우는 것은 다음뿐이다. **여기에 무언가를 추가하기 전에 월 compute 시간을 계산할 것.**

| 주체 | 주기 | DB 접근 |
| --- | --- | --- |
| `ImageAssetCleanupJob` (`@Scheduled`) | `IMAGE_CLEANUP_INTERVAL` = **PT6H** (Render 환경변수) | O — 매 실행 `claimBatch` 쿼리 |
| 실제 사용자 트래픽 | — | O |
| UptimeRobot | 5분 | **X** — `/api/v1/health`는 liveness 전용 |
| `.github/workflows/keep-warm.yml` | KST 08~24시 30분 간격 | **X** — `/health`만 호출 |

`IMAGE_CLEANUP_INTERVAL`의 코드 기본값은 `PT10M`이다. 이 값으로 두면 하루 144회 DB를
깨워 그것만으로 월 한도를 거의 소진한다. **Render 환경변수 설정이 사라지면 재발한다.**

### 11.3 keep-warm에서 DB를 건드리지 않는다

Render를 깨우는 것과 Neon을 깨우는 것은 분리해야 한다. `/api/v1/health`는 liveness
전용이라 DB를 건드리지 않으므로, Render 인스턴스만 깨우면서 Neon compute는 전혀 쓰지
않는다. DB 콜드 스타트 약 1초를 아끼자고 keep-warm에 DB 조회를 넣으면 그 1초를 아끼려다
DB를 통째로 정지시킨다 (11.5 참고).

### 11.4 점검

| 확인할 것 | 위치 |
| --- | --- |
| Neon compute 사용량 | Neon Console → Billing. `Usage since <월 1일>`의 CU-hrs를 100과 비교 |
| Render 환경변수 | Render → 서비스 → Environment. `IMAGE_CLEANUP_INTERVAL`이 남아 있는지 |
| UptimeRobot 감시 URL | UptimeRobot → 모니터. `/api/v1/health`인지 (DB 접근 엔드포인트면 즉시 교체) |
| 앱 기동 실패 원인 | Render → Logs. `exceeded the compute time quota`면 Neon 한도 |

Render 무료 티어는 메모리·CPU 지표를 제공하지 않는다. `Exited with status 1`만 보고
OOM으로 단정하지 말고 **애플리케이션 로그의 스택트레이스를 먼저 확인한다.**

### 11.5 사고 기록 — 2026-08 Neon compute 한도 소진

- **증상**: 2026-08-19 07:26 KST부터 백엔드 다운. Render 인스턴스가 2~4분마다
  `Exited with status 1`로 재시작. TCP 연결과 TLS는 되지만 HTTP 응답이 0바이트.
- **직접 원인**: Neon compute 110.22 / 100 CU-hrs 초과 → Postgres가 인증 단계에서 연결
  거부 → `FlywayMigrationInitializer`에서 기동 실패.
- **근본 원인**: DB를 10분마다 깨우는 것이 두 개 있었다. `ImageAssetCleanupJob`(기본
  `PT10M`)과 keep-warm 워크플로의 `/fish?month=1` 호출. scale-to-zero 5분보다 짧은
  실효 주기라 compute가 상시 가동됐다.
- **증폭**: 앱이 죽자 keep-warm의 헬스체크도 실패했고, `curl -fsS`가 job을 실패시켜
  10분마다 실패 알림이 발송됐다. 알림의 원인과 다운의 원인이 같았다.
- **조치**: keep-warm에서 DB 워밍 제거 + 실패해도 job을 실패시키지 않도록 변경(#35),
  `IMAGE_CLEANUP_INTERVAL=PT6H` 설정(하루 144회 → 4회).
- **교훈**: 콜드 스타트 회피는 가용성 개선처럼 보이지만, 유휴 과금 모델에서는 **예산 소모**다.
  아끼려는 지연(1초)과 잃을 수 있는 것(서비스 전면 정지)의 크기를 먼저 비교한다.
