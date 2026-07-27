# FishNote — 백로그

> 살아있는 문서. 설계 전에 여기서 우선순위를 정하고, 착수하면 `docs/NN_*.md` 설계서로 승격한다.
> 마지막 정리: 2026-07-23 — Phase 5 품질 구현(Q0~F6/B1~B4), Flyway V8~V18,
> 26종 대표 이미지 manifest, 출처/제보, cursor API, 홈 집계, 캐시·readiness·prerender까지 반영.
> Docker·staging·운영 백업/restore·성능 실측은 아래 미완료 항목으로 분리한다.

---

## P1 — 서비스의 신뢰·의무 (다음 설계 대상은 여기서)

### 1. 생선·제철 데이터 출처 확보 ⭐ 가장 중요
현재 시드 데이터(제철 월·맛 설명·팁)는 **검증된 출처가 없다.** 도감 서비스의 근본은 정보 정확성 — 틀린 제철 하나가 신뢰 전체를 깎는다.

- [x] **1차 조사 완료 (2026-07-10, docs/11)** — 숭어 2종 혼동 발견·분리, 연어 연중 전환, 방어·광어 검증 유지. 라이선스 원칙 확립(사실만 참조, 문장은 자체 작성)
- [ ] **2차 주장 검증 계속**: V11·V19에 SEASON 근거 10종(HIGH 8, MEDIUM 2),
  V13에 PHOTO 출처 26종이 저장됐다. 나머지 어종의 SEASON과 전체
  IDENTITY/TASTE/PRICE 주장은 계속 검증해야 한다.
- [ ] 출처 후보 조사 (아래 후보들의 실제 제공 범위·이용 조건 확인 필요):
  - 국립수산과학원(nifs.go.kr) — 수산생명자원·어종 정보
  - 해양수산부 — "이달의 수산물" 월별 선정 자료
  - 공공데이터포털(data.go.kr) — 수산물 관련 공공 데이터셋/API
  - 노량진수산시장·수협 — 시세/계절 어종 참고
  - 위키백과/위키미디어 — 학명·사진(라이선스 확인)
- [x] 출처 관리 방식 구현: claim별 `fish_source` + confidence/verifiedAt, 상세 출처 UI와 정정 제보 API
- [ ] 기존/추가 26종의 SEASON·IDENTITY·TASTE·PRICE claim 전수 검증·교정
- [x] 전체 검증 요약이 사진 근거 하나만으로 “검증 완료”가 되지 않도록 5개 claim 완전성 기준 적용
- [x] 화면 표기: 상세 하단 "정보 출처" 캡션 + `/sources` 검수 원칙 페이지
- 참고: 제철은 문헌마다 다를 수 있음 → "주 출처 1개 고정 + 표기"가 원칙

### 2. 회원 탈퇴 + 개인정보 (법적 의무)
이메일을 수집하는 순간 개인정보보호법 적용 대상이다. 회원 기능을 열었으면 세트로 필요.

- [x] 회원 탈퇴 API + 계정 관리 화면 (비밀번호 재확인, 후기는 익명화)
- [x] 개인정보처리방침 페이지 (수집 항목: 이메일·닉네임 / 보관·파기 기준)
- [x] 이용약관 페이지 (간단 버전)
- [x] 푸터에 링크 노출
- [ ] 비밀번호 변경 (재설정은 이메일 발송 인프라 필요 → P2로)

### 3. 인프라 정리 (사고 예방)
- [x] `api.fishnote.kr` 커스텀 도메인 SG 이전 완료 (Cloudflare CNAME, 2026-07-10)
- [x] Neon 리전 확인 — 싱가포르(서버와 동일)
- [x] keep-warm을 UptimeRobot(5분)으로 교체 — GH cron은 수 시간씩 지연됨
- [ ] 구 Render 서비스 삭제 (URL에 `-sg` 없는 것 확인 후) — 사용자 확인 필요
- [ ] **사용자 데이터 백업 운영**: 암호화 `pg_dump`, 24시간 freshness 검사, 격리 restore drill
  스크립트와 [`OPERATIONS.md`](OPERATIONS.md)는 구현됨. 실제 scheduler·원격 보관·최근 24시간
  artifact·월간 PASS record는 아직 확인하지 않았으므로 완료 처리하지 않는다.
- [ ] 운영 DB의 검수용 테스트 계정(probe-*, a8-*) 정리

### 4. 리디자인 잔여 폴리싱
- [x] R7 — 로딩 스켈레톤·에러 재시도·카피 정리 (2026-07-10)
- [ ] R8 — Vitest/axe/Playwright 자동 검수와 로컬 390×844 실화면 검수는 완료.
  실제 기기 200% zoom, 원격 이미지 crop, Vercel preview·Cloudinary를 포함한 운영 시각 QA는 남아 있다.

### 4.5 콘텐츠 시각 자산
- [x] **대표 사진 manifest/seed 26/26**: `config/fish_image_manifest.json`과 V13에 alt·credit·license·
  source URL·원본 크기·focal point·학명을 기록. 가자미는 특정 종이 아닌 가자미류 사진/표기를 사용.
- [ ] 26개 이미지·26개 원문 URL 응답은 2026-07-25 확인 완료. 실제 배포 crop과
  외부 원본 장기 지속성을 확인하고 필요 시 자체 CDN으로 이관

---

## P2 — 다음 기능 (P1 이후 착수)

### 5. ~~카카오 로그인 (OAuth)~~ ✅ 완료 (POST /auth/kakao, README 참조)

### 6. 콘텐츠 확충: 생선 6종 → 20종+
- 1번(출처)이 선행 조건 — 출처 없이 종만 늘리면 부정확성만 늘어남
- 사진 수급: 공개 자료(docs/08 부록 A 가이드) + Cloudinary 변환으로 톤 통일
- data.sql 관리 한계 도달 시점 → 7번(관리자)과 연계

### 7. 관리자 페이지
- 생선 등록/수정 UI (지금은 data.sql 수정 → push가 유일한 방법)
- users에 `role` 컬럼 (ADMIN) — 인증 기반 위에 올림
- 대상: 생선 CRUD, 사진 업로드(기존 /images 재사용), featured 토글, 후기 관리(신고 삭제)

### 8. 작은 개선 묶음
- [x] 이름·영문명·시장 별칭 검색과 `/fish/suggestions` 자동완성
- [ ] 초성 검색
- [ ] 검색 결과 0건일 때 "요청하기" (없는 생선 수요 파악)
- [ ] refresh 토큰 + 자동 갱신 (현재 access 7일 단일)
- [ ] 비밀번호 재설정 (이메일 발송 — Resend 등 무료 티어)
- [x] ESLint 9 설정 복구 및 error 0건 확인(기존 `Toast.tsx` fast-refresh warning 1건 유지)

---

## P3 — 성장 단계 (방문자 생긴 후)

- [ ] 가성비 횟집 지도 (카카오맵) — v2 간판 기능, 규모 큼
- [x] SEO build 구현: 26개 slug 상세 prerender, canonical/OG/JSON-LD, API 선택 대조, build-time sitemap
- [ ] SEO 운영 확인: Vercel preview route/Insights JavaScript 200, OG 이미지 200, 실제 검색엔진 수집
- [ ] 에러 트래킹(Sentry 무료 티어) + 무료 한도 모니터링(Render/Neon/Cloudinary)
- [ ] 광고 수익화 (기획서 성공 기준 ③) — 트래픽 확보 후
- [ ] 인기 생선 분석 (Vercel Analytics 데이터 활용)

---

## 완료 기록 (요약)

- ✅ 리디자인 R0~R6 + 디자인 시스템 (docs/08, design-reference-v2.html)
- ✅ 후기 사진 업로드 U1·U2 (Cloudinary)
- ✅ BE N+1 제거 + 싱가포르 리전 이전 — /fish 3.8s → 0.43s(2026-07-10 역사 측정)
- ✅ 인증 마일스톤 A1~A8 (docs/09) — JWT·내 도감·북마크 병합·회원 후기 구현·자동 회귀 완료, 운영 통합검수 대기
- ✅ 모바일 하단 내비게이션·44px 터치 영역·후기 페이지네이션·도움돼요 서버 중복 방지
- ✅ Flyway 마이그레이션 전환 + 회원 탈퇴/개인정보/약관 흐름 완성
- ✅ 수집된 상회 시세 공개 API·상세 화면 연동 (원문·발화자·업체명 비공개)
- ✅ README 현행화, 도미 제거, 헤더 검색 상시화
- ✅ Phase 5 FE 품질: responsive filter/detail/price, 부분 실패, dialog·route 접근성, typed analytics
- ✅ Phase 5 BE read/write: v2 cursor/facets, source/correction, atomic helpful/bookmark/OAuth,
  bulk price hash dedup, bounded cache/home/readiness/metrics
- ✅ Flyway V8~V17 expand/backfill/enforce와 V18 contract 파일 작성
- ✅ FE Chromium/WebKit light/dark resilience matrix 12/12, H2 cache/readiness 2건 자동 검증
- ⏳ PostgreSQL Testcontainers runtime(Docker), staging/운영 migration dry-run, 실제 백업/restore,
  Vercel Insights·OG, warm p95/LCP는 환경 의존 검증 대기
