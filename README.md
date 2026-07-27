# FishNote

회에 관심 있는 사람이 "내가 먹는 회가 어떤 생선인지, 언제가 제철인지, 맛은 어떤지"를 둘러보고 검색하는 **회 도감** 서비스입니다.

- 운영: https://www.fishnote.kr
- 스택: React(Vite/TS) + Spring Boot(Java 17) + PostgreSQL
- 설계 문서: [`docs/`](docs/) (DB 설계 · API 명세 · 아키텍처 · 리디자인/기능 티켓)

## 아키텍처

```
[React (FE)] ──REST──> [Spring Boot (BE)] ──JPA──> [PostgreSQL]
  Vercel 배포             Render 배포                Neon (serverless)
  fishnote.kr             *.onrender.com             ap-* 리전
                              │
                          [Cloudinary]  ← 후기 사진 업로드
```

## 로컬 개발

### 백엔드

로컬 PostgreSQL이 있으면:

```bash
createdb fishnote
cd BE && ./gradlew bootRun        # http://localhost:8080
```

로컬 PostgreSQL이 없으면 인메모리 H2로 실행할 수 있습니다:

```bash
cd BE && SPRING_PROFILES_ACTIVE=test ./gradlew bootTestRun
```

환경변수 (없으면 해당 기능만 비활성/부팅 실패):

```text
SPRING_DATASOURCE_URL=jdbc:postgresql://localhost:5432/fishnote   # 기본값 있음
SPRING_DATASOURCE_USERNAME=postgres
SPRING_DATASOURCE_PASSWORD=
JWT_SECRET=<32-byte-or-longer-random-secret>           # 로그인 토큰 서명 — 필수
KAKAO_REST_API_KEY=<kakao-rest-api-key>                # 카카오 로그인 — 서버의 코드 교환용
KAKAO_CLIENT_SECRET=<kakao-client-secret>              # 카카오 로그인 — 서버 전용, 외부 노출 금지
KAKAO_ALLOWED_REDIRECT_URIS=http://localhost:5173/auth/kakao/callback # 쉼표 구분 exact allowlist
CLOUDINARY_URL=cloudinary://<key>:<secret>@<cloud>   # 사진 업로드 — 필수 (부팅 시 검증)
TELEGRAM_WEBHOOK_SECRET=<random-secret>              # 텔레그램 시세 수집 웹훅
TELEGRAM_CONNECT_TIMEOUT=PT2S                        # Telegram API 연결 제한
TELEGRAM_READ_TIMEOUT=PT3S                           # Telegram API 응답 제한
TELEGRAM_REPLY_QUEUE_CAPACITY=100                    # commit 후 비동기 reply 대기열
HELPFUL_VOTE_PEPPER=<random-secret>                  # 도움돼요 중복 방지 해시
IMAGE_UPLOADER_KEY_SECRET=<32-byte-or-longer-random-secret> # 이미지 업로더 익명화 HMAC — 필수
IMAGE_CLEANUP_ENABLED=true                              # 만료·고아 후기 이미지 정리
IMAGE_CLEANUP_INTERVAL=PT10M                           # 정리 주기(ISO-8601 duration)
IMAGE_CLEANUP_BATCH_SIZE=50                            # 실행당 최대 자산 수(1~1000)
IMAGE_CLOUDINARY_TIMEOUT_SECONDS=10                    # upload/destroy HTTP timeout(1~60초)
IMAGE_UPLOAD_GLOBAL_LIMIT=40                           # 10분당 전체 이미지 업로드 상한
APP_CLIENT_IP_TRUSTED_PROXIES=<verified-render-edge-cidrs> # 신뢰할 reverse proxy CIDR, 쉼표 구분
REVIEW_STAT_READ_MODEL_ENABLED=true                   # false면 후기 실시간 집계 fallback
CATALOG_V2_ENABLED=true                               # /api/v2/fish 공개 여부
PRICE_IMPORT_BULK_ENABLED=true                        # false면 webhook당 최대 50행 legacy persist 경로
SOURCES_ENABLED=true                                  # 출처 API 공개 여부
PUBLIC_CACHE_ENABLED=true                             # false면 Caffeine 비활성 + public 응답 no-store
SPRING_FLYWAY_TARGET=17                               # V18 contract 전 안정화 배포에서만 사용
```

빠른 단위 테스트는 H2를 사용하고, 실제 PostgreSQL/Flyway·동시성·쿼리 예산 계약은
Testcontainers로 분리되어 있습니다.

```bash
cd BE
./gradlew --no-daemon test                    # H2 단위·MVC 계약
./gradlew --no-daemon integrationTestClasses # Docker 없이 통합 테스트 컴파일만
./gradlew --no-daemon integrationTest        # Docker 필요: PostgreSQL 16 Testcontainers
./gradlew --no-daemon check                  # test + integrationTest
```

`integrationTest`는 Docker daemon이 필요한 환경 의존 검증입니다. 로컬에 Docker가 없으면
컴파일 성공을 실행 성공으로 간주하지 않습니다.

### 프론트엔드

```bash
cd FE
npm install
npm run dev                        # http://localhost:5173
npm run test                       # Vitest
npm run test:prerender             # 빌드 산출물 SEO 계약
npm run test:e2e:run               # Playwright, 사전 build 필요
npm run check                      # lint + unit + build/prerender + E2E
```

`FE/.env`:

```text
VITE_API_BASE_URL=http://localhost:8080/api/v1
VITE_CATALOG_V2_ENABLED=true
VITE_REVIEW_V2_ENABLED=true
VITE_KAKAO_REST_API_KEY=<kakao-rest-api-key>
```

`npm run build`는 다음을 한 명령에서 수행합니다.

1. DB seed·`config/fish_image_manifest.json`과 `FE/prerender/catalog.json`의 26종 일치 확인
2. TypeScript/Vite build
3. `/fish/{slug}/index.html` 26개, 홈 정적 목록, `sitemap.xml`, private-route용
   `spa-noindex.html` 생성

기본 canonical origin은 `https://fishnote.kr`입니다. 다른 공개 origin으로 빌드할 때는
`PUBLIC_SITE_URL`을 설정합니다. `PRERENDER_API_BASE_URL`을 설정하면 build가 실제 공개 Fish API도
읽고, API 어종 수가 26종 catalog와 다르면 실패합니다. 이 변수 없이도 seed/manifest 계약은
항상 검사하지만 실제 배포 API와의 비교까지 수행하는 것은 아닙니다.

### 카카오 로그인 설정

1. 카카오 디벨로퍼스 앱에서 카카오 로그인을 활성화하고 Client Secret을 발급·활성화합니다.
2. 동의 항목에서 닉네임을 설정합니다. 이메일 권한이 없어도 카카오 서비스 사용자 식별자로 가입할 수 있습니다.
3. Redirect URI에 실제 프론트엔드 origin별 콜백을 정확히 등록합니다.

```text
http://localhost:5173/auth/kakao/callback
https://fishnote.kr/auth/kakao/callback
https://www.fishnote.kr/auth/kakao/callback
```

REST API 키는 프론트와 백엔드에 같은 값을 설정합니다. Client Secret은 `KAKAO_CLIENT_SECRET`으로 백엔드에만 설정하며 저장소나 Vercel 환경변수에는 넣지 않습니다. 카카오가 검증된 이메일을 제공하면 기존 이메일 회원과 연결하고, 이메일이 없으면 카카오 식별자만으로 전용 계정을 만듭니다. 인가 코드는 백엔드가 토큰으로 교환한 뒤 기존 FishNote JWT를 발급합니다.

## API 요약

Base URL: `/api/v1`, `/api/v2` — 상세 명세는 [`docs/04_API명세.md`](docs/04_API명세.md)

- `GET /fish` — 목록 (search/season/taste/priceLevel/month/featured/sort)
- `GET /fish/{id|slug}` — 상세 (media·갤러리·팁·별점 분포·비슷한 횟감 포함)
- `GET /fish/suggestions?q=...` — 이름·영문명·시장 별칭 자동완성
- `GET /fish/{id|slug}/sources` · `POST /fish/{id}/corrections` — 주장별 출처·오류 제보
- `GET /home?month=7&sort=popular` — 홈 seasonal/featured/catalog/facets 통합
- `GET /fish/{id}/prices?days=14&resolution=DAY&maxPoints=30` — 최근 상회 시세 projection
- `GET /api/v2/fish` — cursor·facets·alias 검색 목록
- `GET /api/v2/fish/{id|slug}` · `GET /api/v2/fish/{id}/reviews` — projection 상세·cursor 후기
- `GET /fish/{id}/reviews` · `POST /fish/{id}/reviews` — 후기 (익명 + 삭제용 비밀번호)
- `DELETE /reviews/{id}` · `POST /reviews/{id}/helpful`
- `GET/PUT/DELETE /me/bookmarks` · `POST /me/bookmarks/merge` — 회원 내 도감
- `DELETE /auth/me` — 비밀번호 확인 후 회원 탈퇴
- `POST /auth/kakao` — 카카오 인가 코드 검증 후 FishNote JWT 발급
- `POST /images` — 후기 사진 업로드 (Cloudinary 경유, JPEG/PNG/정적 GIF/정적 WebP, 5MB·8192px·50MP 이하, `assetId`·만료시각 반환)
- `GET /actuator/health/liveness` · `/actuator/health/readiness` — 프로세스/DB 준비 상태 분리

공개 목록은 `Cache-Control: public, max-age=60`, 상세은 5분+ETag, 가격은 3분을 사용합니다.
서버 Caffeine은 catalog 30분, detail/price 5분, home 1분의 bounded cache이며,
후기·인증·북마크·이미지·제보와 모든 오류 응답은 `private, no-store`입니다.

## 배포

| 영역 | 플랫폼 | 메모 |
|---|---|---|
| FE | Vercel | 루트 디렉터리 `FE`, 빌드 `npm run build` → `dist`. `vercel.json`이 SPA 라우팅 처리 |
| BE | Render (Web Service) | 루트 디렉터리 `BE`, Docker 빌드(`BE/Dockerfile`), `PORT` 자동 주입 |
| DB | Neon (serverless PostgreSQL) | 접속 정보를 Render 환경변수로 주입 |
| 이미지 | Cloudinary | `fishnote/reviews` 폴더 |
| 도메인 | fishnote.kr → Vercel | |

### Render 환경변수

```text
SPRING_DATASOURCE_URL=jdbc:postgresql://<neon-host>/<db>?sslmode=require
SPRING_DATASOURCE_USERNAME=<neon-role>
SPRING_DATASOURCE_PASSWORD=<neon-password>
APP_CORS_ALLOWED_ORIGINS=https://fishnote.kr,https://www.fishnote.kr,https://<vercel-project>.vercel.app
JWT_SECRET=<32-byte-or-longer-random-secret>
KAKAO_REST_API_KEY=<kakao-rest-api-key>
KAKAO_CLIENT_SECRET=<kakao-client-secret>
KAKAO_ALLOWED_REDIRECT_URIS=https://fishnote.kr/auth/kakao/callback,https://www.fishnote.kr/auth/kakao/callback
CLOUDINARY_URL=cloudinary://<key>:<secret>@<cloud>
TELEGRAM_WEBHOOK_SECRET=<random-secret>
TELEGRAM_CONNECT_TIMEOUT=PT2S
TELEGRAM_READ_TIMEOUT=PT3S
TELEGRAM_REPLY_QUEUE_CAPACITY=100
HELPFUL_VOTE_PEPPER=<random-secret>
IMAGE_UPLOADER_KEY_SECRET=<32-byte-or-longer-random-secret>
IMAGE_CLEANUP_ENABLED=true
IMAGE_CLEANUP_INTERVAL=PT10M
IMAGE_CLEANUP_BATCH_SIZE=50
IMAGE_CLOUDINARY_TIMEOUT_SECONDS=10
IMAGE_UPLOAD_GLOBAL_LIMIT=40
APP_CLIENT_IP_TRUSTED_PROXIES=<verified-render-edge-cidrs>
# 실제 proxy chain 검증 전 초기 배포에서는 false, 검증 완료 뒤 true
RATE_LIMIT_ENABLED=false
REVIEW_STAT_READ_MODEL_ENABLED=true
CATALOG_V2_ENABLED=true
PRICE_IMPORT_BULK_ENABLED=true
SOURCES_ENABLED=true
PUBLIC_CACHE_ENABLED=true
# 안정화 배포에서만 17로 고정. V18 contract 승인 뒤 이 변수를 제거한다.
SPRING_FLYWAY_TARGET=17
```

> ⚠️ `CLOUDINARY_URL` 또는 32바이트 이상의 `IMAGE_UPLOADER_KEY_SECRET`이 없으면 서버가 부팅되지 않습니다(fail-fast). **환경변수를 먼저 넣고 배포**하세요.

### Flyway V15~V18 배포 순서

가격 중복키 변경은 한 번에 적용하지 않습니다.

1. V15: nullable `dedup_hash`와 구 버전 writer 호환 trigger 추가(expand)
2. V16: hash backfill, 중복 row audit·정리, `NOT NULL`·format check·unique index 적용
3. V17: 양수 가격·최저≤최고·confidence 0~1 CHECK 검증
4. 애플리케이션 안정화 기간에는 `SPRING_FLYWAY_TARGET=17` 유지
5. 백업·복구 훈련, migration dry-run, 구 버전 rollback 불필요를 확인한 뒤 target 제한을 제거하여
   V18에서 `raw_text` 포함 legacy unique constraint를 제거(contract)

이미 적용된 migration 파일과 checksum은 수정하지 않습니다. 문제 발생 시 flag/애플리케이션을
되돌리고 새 forward-fix migration을 추가합니다. 운영 DB를 과거 dump로 덮어 배포를 롤백하지
않습니다. 상세 절차는 [`docs/OPERATIONS.md`](docs/OPERATIONS.md)를 따릅니다.

`APP_CLIENT_IP_TRUSTED_PROXIES`에는 staging에서 확인한 즉시 upstream Render edge CIDR만 넣습니다.
미설정 또는 잘못된 체인은 `X-Forwarded-For`를 무시하도록 fail-closed 동작합니다. 초기 배포에서는
`RATE_LIMIT_ENABLED=false`로 두고, 실제 요청 경로에 포함된 Cloudflare와 Render의 proxy chain을
확인한 뒤 즉시 upstream peer 대역만 등록하고 limiter를 켭니다. 배포 전 같은 실제 클라이언트에서 서로 다른
`X-Forwarded-For` 값을 보낸 11번째 후기 요청이 동일 bucket의 429가 되는지 확인하고, 다른 네트워크의
첫 요청은 차단되지 않는지도 함께 확인합니다. 인스턴스를 2개 이상으로 늘리기 전에는 limiter를
Redis/Bucket4j 기반으로 교체해야 합니다.

후기 이미지는 서버가 발급한 `public_id`와 자산 ID로 추적합니다. 후기 삭제 시 같은 DB
트랜잭션에서 자산을 삭제 대기로 분리하고, 스케줄러가 작은 batch를 선점한 뒤 DB 트랜잭션
밖에서 Cloudinary 원본을 삭제합니다. 실패한 항목과 중단된 claim은 다음 실행에서 재시도되며,
성공·실패·timeout은 URL이나 secret을 tag로 쓰지 않는 bounded external metric으로 기록합니다.
운영 배포 전 `DELETE_PENDING`의 최고 대기시간·활성 claim 수와 Cloudinary quota 감소를 확인합니다.
V8과 V9 사이 rolling 구간에서 구 인스턴스가 만든 metadata 없는 `DELETE_PENDING`도 새 worker가
보수적인 24시간 tombstone으로 승격하므로, 마이그레이션은 되돌리지 말고 V9까지 순서대로 적용합니다.

### 도감 대표 이미지 manifest

공개 도감 대표 이미지의 source of truth는 `config/fish_image_manifest.json`입니다. `READY` 항목은
카탈로그 이름과 정확히 식별되는 종, 상업 이용 가능한 라이선스, 원문 URL, 촬영자/제공기관,
원본 크기, 한국어 alt와 focal point가 모두 검수된 경우에만 허용합니다. 이 정보는 V13에서
`fish_image` metadata와 `PHOTO` 출처로 함께 저장되고, `fish.image_url`은 한 릴리스 동안 같은
대표 URL을 legacy fallback으로 유지합니다.

26개 항목 모두 검수 완료 상태입니다. ID 20 `가자미`는 특정 단일 종이 아닌 가자미류
일반명임을 감추지 않도록 `Pleuronectidae spp.`로 표기하고, 특정 종 사진 대신 시장에서 촬영된
가자미류 대표 사진을 사용합니다. alt·출처 제목도 `가자미류` 범위를 명시해 종 오인을 피합니다.

manifest나 seed를 변경할 때는 저장소 루트에서 다음 검사를 모두 실행합니다.

```bash
python3 scripts/validate_fish_image_manifest.py
python3 -m unittest scripts/test_fish_image_manifest.py
python3 scripts/render_fish_image_seed.py \
  --check BE/src/main/resources/db/migration/V13__seed_verified_fish_images.sql
```

V13이 아직 어느 환경에도 적용되지 않은 경우에만 manifest를 수정한 뒤 renderer 출력으로 V13을
재생성합니다. 한 번이라도 적용된 뒤에는 V13 checksum을 바꾸지 말고 같은 검증 규칙을 사용하는
새 forward-only Flyway migration을 추가합니다.

### Vercel 환경변수

```text
VITE_API_BASE_URL=https://<render-service>.onrender.com/api/v1
VITE_CATALOG_V2_ENABLED=true
VITE_REVIEW_V2_ENABLED=true
VITE_KAKAO_REST_API_KEY=<kakao-rest-api-key>
PUBLIC_SITE_URL=https://fishnote.kr
# 선택: build 시 실제 API count까지 대조할 때만 설정
PRERENDER_API_BASE_URL=https://<render-service>.onrender.com/api/v1
```

### 무료 티어 참고

- Render 무료 인스턴스는 15분 무접속 시 잠듭니다 → `.github/workflows/keep-warm.yml`이 10분마다 헬스체크로 깨워둡니다.
- Neon 무료 티어도 유휴 시 잠들어 첫 DB 쿼리가 ~1초 느릴 수 있습니다.

## 운영 팁

- DB 스키마와 초기 도감 데이터는 `BE/src/main/resources/db/migration/`의 Flyway 마이그레이션으로 관리합니다.
- 이미 적용된 마이그레이션은 수정하지 않고, 스키마·콘텐츠 변경마다 다음 버전(`V3__...sql`) 파일을 추가합니다.
- Hibernate는 운영 스키마를 직접 변경하지 않고 `validate`로 엔티티 매핑만 검증합니다.
- `/api/v1/health`는 liveness 안내용입니다. 트래픽 투입·migration 확인에는 DB가 포함된
  `/actuator/health/readiness`를 사용합니다.
- 매일 암호화 백업, 24시간 freshness 검증, 월 1회 격리 restore drill과 rollback 절차는
  [`docs/OPERATIONS.md`](docs/OPERATIONS.md)에 있습니다. 스크립트 존재나 정적 self-check는
  실제 운영 백업·restore drill 완료를 의미하지 않습니다.

## 데이터 수집

상회/카톡방 시세를 1차 가격으로 보고, 노량진 경락가와 KAMIS는 보조 검증용으로 사용합니다.

카카오톡 메시지를 복사한 뒤 클립보드에서 바로 CSV로 파싱할 수 있습니다.

```bash
python3 scripts/kakao_price_parser.py --clipboard --out data/shop-prices/2026-07-13.csv
```

대화 내보내기 `.txt` 파일도 지원합니다.

```bash
python3 scripts/kakao_price_parser.py ~/Downloads/kakao-export.txt --out data/shop-prices/2026-07-13.csv
```

- 기본 출력: `data/shop-prices/<input-name>.csv`
- 어종 매핑: 실행 중인 백엔드의 `fish_alias` 기반 `/api/v1/fish/aliases/price-parser`
- 다른 환경에서는 `FISHNOTE_ALIAS_MANIFEST_URL` 또는 `--alias-manifest`로 manifest URL/JSON 경로를 지정합니다.
- 기본 파싱 시간대: 오전 6시~11시
- `raw_text`를 함께 저장해 오인식 값을 나중에 검수할 수 있습니다.

텔레그램 봇을 백엔드에 연결하면 CSV 파일을 만들지 않고 바로 DB에 저장할 수 있습니다.

```bash
curl "https://api.telegram.org/bot<bot-token>/setWebhook" \
  -d "url=https://<render-service>.onrender.com/api/v1/integrations/telegram/price-updates" \
  -d "secret_token=$TELEGRAM_WEBHOOK_SECRET"
```

운영 흐름:

1. BotFather에서 봇을 만들고 `<bot-token>`을 받습니다.
2. Render에 `TELEGRAM_WEBHOOK_SECRET`을 추가합니다.
3. 위 `setWebhook` 명령으로 봇을 백엔드 웹훅에 연결합니다.
4. 카카오톡 상회 시세표 전체 텍스트를 텔레그램 봇에게 전달합니다.
5. 백엔드는 `shop_price_observation`에 파싱 결과를 저장하고, 같은 텍스트는 중복 저장하지 않습니다.

`GET /fish/{id}/prices`는 가격·관측 시각·산지·규격·단위와 가격 비교에 필요한 출처·상회명을 공개합니다. 검수용 원문, 발화자, 원문 어종명은 API 응답에 포함하지 않습니다.

노량진 공식 경락시세도 CSV로 수집할 수 있습니다.

```bash
python3 scripts/noryangjin_price_scraper.py --date 2026-07-10
python3 scripts/noryangjin_price_scraper.py --date 2026-07-10 --species 참돔 --out data/noryangjin/chamdom.csv
```

- 기본 출력: `data/noryangjin/YYYY-MM-DD.csv`
- 어종 매핑: `config/noryangjin_species_aliases.csv`
- 원천: 노량진수산주식회사 `오늘의 경락시세`
