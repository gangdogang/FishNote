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

## 교훈 모음

1. **삭제는 항상 마지막** — 새로 만들고, 확인하고, 그다음 지운다
2. **환경변수가 코드보다 먼저** — fail-fast 설계는 좋지만 배포 순서를 지켜야 한다
3. **데이터를 여러 바구니에** — 코드=GitHub, 데이터=Neon, 사진=Cloudinary 분리가 사고에서 살렸다
4. **N+1은 가까운 DB에선 안 보인다** — 원거리 DB가 비효율을 드러냈고, 근본 해법은 리전 정렬
5. **도감의 생명은 정확성** — 상식으로 쓴 데이터도 검증하면 오류가 나온다(숭어). 사실은 출처 표기, 문장은 자체 작성
