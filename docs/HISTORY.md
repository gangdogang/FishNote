# FishNote — 작업 기록

> 살아있는 문서. 큰 작업이 끝날 때마다 여기에 추가한다. (백로그는 `BACKLOG.md`, 설계서는 `docs/NN_*.md`)
> 기간: 2026-07-09 ~ 07-10 · 커밋 29개 · 95개 파일 · +6,044 / −1,054줄

---

## 현재 시스템 구성 (2026-07-10 기준)

```
[사용자] ── fishnote.kr / www.fishnote.kr ──> [Vercel]  React FE
                                                  │
                                    api.fishnote.kr (또는 직접 주소)
                                                  ▼
              [Render 싱가포르]  Spring Boot BE (fishbook-api-sg)
                     │                    │
              [Neon 싱가포르]        [Cloudinary]
              PostgreSQL DB          후기 사진 저장
```

| 구성 | 내용 |
|---|---|
| 도메인 | **웹티즌에서 구입** → 네임서버를 **Cloudflare**로 위임 → DNS 관리는 Cloudflare에서 |
| FE | Vercel, 루트 `FE/`, main 푸시 시 자동 배포 |
| BE | Render 무료(싱가포르), Docker 빌드, main 푸시 시 자동 배포. 15분 무접속 시 잠듦 → GitHub Actions가 10분마다 `api.fishnote.kr/api/v1/health` 핑 |
| DB | Neon 무료 (AWS ap-southeast-1 싱가포르) — 서버와 같은 리전 |
| Render 환경변수 | `SPRING_DATASOURCE_*`(Neon), `APP_CORS_ALLOWED_ORIGINS`, `CLOUDINARY_URL`, `JWT_SECRET` |
| Vercel 환경변수 | `VITE_API_BASE_URL` |
| 성능 | 목록 API 0.4초대 (시작 시점 3.8초 → 약 9배 개선) |
| 데이터 | 생선 18종, 후기·회원은 Neon에만 존재(백업 과제 남음) |

---

## 타임라인

### 1. 디자인 리뉴얼 (docs/08, R0~R7)
- 기획.md·API 명세 기반으로 기존 FE를 보지 않고 디자인 재설계 → 시안 `design-reference-v2.html`
- 디자인 원칙: ① "지금 제철"만 색으로 강조 ② 전문용어 제로(₩₩ 보통, 제철 11–2월) ③ 한 화면 한 가지 일
- R0 토큰(물빛 #0F6E84)·Pretendard → R1 공통 컴포넌트(지금 제철 뱃지, 월 축약) → R2 헤더(잘못된 '후기' 메뉴 제거) → R3 홈(검색 히어로+이달의 제철) → R4 상세(2컬럼, 정보 중복 제거) → R5 캘린더·저장 → R6 후기(인라인 폼, 선택식 별점, 도움돼요) → R7 스켈레톤·카피
- 이후 공용 컴포넌트 리팩터링으로 중복 72줄 순삭

### 2. 후기 사진 업로드 (U1·U2)
- 사용자는 파일만 선택 → BE가 Cloudinary(`fishnote/reviews`)에 업로드 → URL만 DB 저장
- 검증: 5MB 이하, image/*만. 키는 `CLOUDINARY_URL` 환경변수로만

### 3. Render 사고와 복구 (07-09)
- 실수로 Render 서비스 전체 삭제 → **데이터는 Neon에 있어 무사** (코드=GitHub, 데이터=Neon, 설정=재입력 가능 구조 덕분)
- 새 서비스로 복구. 교훈: **"새로 만들고 → 확인하고 → 삭제는 마지막"**, 환경변수는 코드 배포보다 먼저

### 4. 성능 (3.8초 → 0.4초)
- 원인: 생선마다 별점·태그를 따로 쿼리(N+1, 25회) × 원거리 DB 왕복
- 조치: GROUP BY 집계 1회 + batch fetch + EntityGraph → 쿼리 25→2회
- 서버를 싱가포르로 이전(Neon과 같은 리전) → 왕복 150ms → 수 ms

### 5. 인증 + 내 도감 (docs/09, A1~A8)
- 이메일 가입/로그인(JWT 7일, Bearer+localStorage — 크로스 도메인이라 쿠키 대신)
- 내 도감: 북마크 서버 저장, 로그인 시 localStorage 병합 모달(1회)
- 회원 후기: 닉네임 자동, 비밀번호 없이 삭제, `mine` 플래그. **익명 흐름은 그대로 유지**(로그인 강요 없음)
- 운영 통합검수 통과 (익명 회귀·회원 작성·mine 노출 범위·병합)

### 6. 콘텐츠·데이터
- 도미 제거(참돔과 중복) — 매 부팅 실행되는 data.sql 특성상 가드 DELETE로 운영 DB까지 정리
- 6종 → 12종 추가(17종) → **딥리서치 1차 검증**(docs/11):
  - 🚨 "숭어 1~3월"은 두 종 혼동 → **가숭어**(참숭어·밀치, 겨울 11~2월) / **숭어**(보리숭어, 봄 3~6월) 분리 → 18종
  - 연어: 국내 유통 대부분 노르웨이산 양식 → "연중"으로 정정
  - 방어·광어 11~2월은 교차검증 통과
  - 라이선스 원칙: 제철 '사실'은 출처 표기 후 사용, 설명 '문장'은 자체 작성 (일부 공공 콘텐츠는 상업이용 금지)
- 미확정 13종은 2차 조사 대상 (BACKLOG P1-1)

### 7. 인프라 정리 (07-10)
- `api.fishnote.kr` → 싱가포르 서비스로 이전 (Render Custom Domain + Cloudflare CNAME, DNS only)
- keep-warm을 도메인 기준으로 변경 — 이후 서버 이동은 DNS 수정만으로 끝
- README를 실제 스택(Render+Neon+Vercel+Cloudinary)으로 현행화
- 구 서비스(`fishbook-api`, URL pdyx) 삭제 승인됨 — 삭제 시 `-sg` 아닌 것인지 URL 재확인

---

## 커밋 로그 (955a77b 이후)

```
476ea73 R0 디자인 토큰·Pretendard          251b0f1 A1 인증(JWT)
11714b6 R1 공통 컴포넌트                    398c8e0 A2 내 북마크 API
cccfaaa R2 헤더·레이아웃                    f1992ab A3 후기-회원 연결
dd55189 R3 홈 개편                          cc56c2a A4 FE 인증 기반
d32b491 R4 상세 페이지                      6398751 A5 로그인 화면·계정 메뉴
1c63a19 R5 캘린더·저장                      c582e95 A6 북마크 서버화·병합
7b509c0 R6 후기 UI                          51f83af A7 후기 폼 로그인 모드
3031d32 U1 이미지 업로드 API                447b78a 백로그 정리
0a33cd8 U2 후기 사진 첨부                   00cdd40 생선 12종 추가(17종)
a2ba4d1 공용 컴포넌트 리팩터링              8167ffa R7 스켈레톤·카피
3ad98c2 perf N+1 제거(목록)                 5f2c3f2 숭어 분리·연어 연중(18종)
f4f398a perf 상세·후기 쿼리 감축            f7e7766 keep-warm 도메인화
58bcf9a 도미 제거·헤더 검색 상시            712bcef/bbf90cf keep-warm 주소 변경
24053b4 README 현행화                       08b7fc8 docs/09 인증 설계서
```

### 8. 사진 로딩·콜드스타트 개선 (07-10)
- "오랜만에 방문하면 안 뜬다" 원인 규명: **GitHub Actions cron이 10분 설정임에도 실제로는 1.5~4시간에 1회만 실행** (무료 저장소 예약 작업 지연) → 서버가 거의 항상 잠들어 방문마다 ~50초 냉기동
- 해결: **UptimeRobot**(외부 모니터링, 5분 간격)으로 keep-warm 주체 교체 — GH Actions는 백업 강등. 덤으로 다운타임 이메일 알림 확보
- 후기 사진: 업로드 시 자동 축소(w_1600) + 표시 시 최적화 변환(f_auto,q_auto,w_800) + 전체 이미지 lazy loading — 원본 5MB 서빙 구조 제거
- 참고: GitHub 저장소명이 FishBook → **FishNote**로 변경됨

### 9. 제품 품질 개선 Phase 5 (07-22~07-23)

`docs/13_제품품질_개선_구현설계.md`를 기준으로 기존 디자인 언어와 `/api/v1` 호환성을
유지하면서 FE 접근성·데이터 신뢰·read/write 경로·운영 안전장치를 확장했다.

FE:

- FishCard의 Link/button 중첩을 제거하고 SmartImage·broken-image fallback·실제 metadata 기반 alt 적용
- 모바일 filter sheet, 상세 정보 우선 순서, 반응형 가격 chart+table, price/review/source 부분 오류 분리
- dialog focus trap/restore, route focus/announce, form label/error, safe-area·dark 대비 회귀 추가
- 홈을 `GET /api/v1/home` 한 요청으로 통합하고 측정 전 “인기/에디터 추천” 카피를 규칙형으로 교체
- typed Analytics event와 PII/URL 방지 wrapper 추가
- seed/manifest 기반 공개 26종 catalog를 build에서 검증하고 slug 상세 26개·홈 ItemList·sitemap·
  private noindex shell을 prerender

BE/API:

- `/api/v2/fish` cursor/facets/alias 검색, v2 cursor 후기, ID/slug 상세 projection과 `ratingCount`
- claim별 출처·검증 상태·오류 제보, 26종 media metadata와 PHOTO 출처
- helpful CTE, bookmark PUT/merge, Kakao 최초 연결을 PostgreSQL 원자/동시성 경로로 변경
- 시세 parse/transaction 분리, 최대 200행 multi-values insert, SHA-256 hash dedup,
  raw text 없는 가격 projection, commit 후 touched-Fish cache eviction/Telegram reply
- bounded Caffeine, public Cache-Control/ETag, private no-store, DB readiness와 bounded-tag metric/trace 추가
- Cloudinary upload/destroy duration·timeout을 bounded provider/operation tag로 계측하고 URL secret·SDK cause 로그를 제거
- 암호화 backup·freshness·격리 restore drill 스크립트와 [`OPERATIONS.md`](OPERATIONS.md) 작성

Flyway 기록:

| 버전 | 내용 |
|---|---|
| V8 | 후기 이미지 자산 lifecycle |
| V9 | cleanup claim/retry fencing |
| V10 | slug/category/scientific name, alias, pg_trgm |
| V11 | source/correction + 검증 SEASON 6건 |
| V12 | fish image metadata expand |
| V13 | reviewed PRIMARY/PHOTO 26/26 seed |
| V14 | fish review stat read model·cursor index |
| V15 | nullable price `dedup_hash` + compatibility trigger(expand) |
| V16 | duplicate audit, hash backfill·NOT NULL·unique(enforce) |
| V17 | 양수 가격·range·confidence CHECK |
| V18 | legacy raw-text unique 제거(contract) |

V18은 즉시 적용 대상으로 기록하지 않는다. V16/V17 안정화 릴리스는
`SPRING_FLYWAY_TARGET=17`을 사용하고, 운영 snapshot dry-run·백업/복구·구 버전 rollback 불필요를
확인한 뒤 target 제한을 제거한다.

검증 기록:

- FE Chromium/WebKit × light/dark resilience matrix: 12/12 실행 완료
- H2 public cache/readiness 계약: 2건 실행 완료
- lint: error 0, 기존 `Toast.tsx` fast-refresh warning 1 유지
- PostgreSQL 대형 fixture/query budget, 100행 import 3 statement 이하, helpful/bookmark/OAuth/merge
  동시성, review stat consistency Testcontainers는 구현·컴파일됨
- 문서 동기화 시점의 로컬 환경에는 Docker가 없어 PostgreSQL Testcontainers runtime은 미실행
- staging migration dry-run, 실제 운영 backup/restore record, Vercel Insights/OG 200,
  warm p95·Web Vitals는 미검증

이 Phase 5에는 새 성능 전/후 수치를 기록하지 않는다. 위 §4의 3.8초→0.4초는 07-10 당시의
역사적 측정이며 현재 endpoint·fixture의 성능 근거로 재사용하지 않는다.

## 교훈 모음

1. **삭제는 항상 마지막** — 새로 만들고, 확인하고, 그다음 지운다
2. **환경변수가 코드보다 먼저** — fail-fast 설계는 좋지만 배포 순서를 지켜야 한다
3. **데이터를 여러 바구니에** — 코드=GitHub, 데이터=Neon, 사진=Cloudinary 분리가 사고에서 살렸다
4. **N+1은 가까운 DB에선 안 보인다** — 원거리 DB가 비효율을 드러냈고, 근본 해법은 리전 정렬
5. **도감의 생명은 정확성** — 상식으로 쓴 데이터도 검증하면 오류가 나온다(숭어). 사실은 출처 표기, 문장은 자체 작성
6. **무료 cron은 시계가 아니다** — GitHub Actions 예약 작업은 수 시간씩 밀린다. 주기가 중요한 작업은 전용 모니터링 서비스(UptimeRobot 등)에 맡길 것
