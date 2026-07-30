# FishNote UI/UX 개선 구현

> 작성일: 2026-07-30
> 기준: React 19 + Tailwind CSS 3.4, 로컬 코드, Playwright 기준 화면
> (320×568, 390×844, 768×1024, 1024×768, 1440×900 / light·dark)

## 1. 목표

전면 재디자인보다 실제 탐색과 선택 과정에서 신뢰를 떨어뜨리는 문제를 먼저 해결한다.

1. 모바일 고정 UI가 본문을 가리지 않는다.
2. 저장·병합 결과를 실제 서버 상태와 일치시킨다.
3. 검색 결과가 커져도 누락되지 않고, 필터 변경 중 화면이 안정적으로 유지된다.
4. 긴 상세 화면에서 맛·가격·후기·출처로 빠르게 이동할 수 있다.
5. 비밀번호 입력 실수를 제출 전에 줄인다.
6. ARIA 역할과 실제 키보드 동작을 일치시킨다.

## 2. 구현 범위

### P1 — 즉시 수정

- [x] 홈 모바일 보조 검색창을 sticky header의 실제 문서 흐름에 포함
- [x] 공통 header/anchor offset 토큰 적용
- [x] 서버 북마크 성공 토스트를 응답 이후에 노출
- [x] 서버 북마크 실패 토스트와 optimistic rollback 제공
- [x] 북마크 pending 상태를 횟감별로 분리
- [x] v2 catalog cursor를 보존하고 검색 결과에 `더 보기` 제공
- [x] 100개 이후 결과가 있을 때 `N개 이상`으로 정확히 표기

### P2 — 사용 흐름 개선

- [x] 검색·캘린더 필터 변경 중 기존 결과 유지
- [x] 검색 facet 수치를 필터에 보조 정보로 노출
- [x] 320px 또는 짧은 viewport에서 홈 hero 높이 축소
- [x] 상세 화면에 sticky 로컬 내비게이션 추가
- [x] 검증 요약을 소비자 핵심 정보보다 무겁지 않은 surface로 축소
- [x] 북마크 병합의 `나중에`를 `이번에는 건너뛰기`로 명확화
- [x] 계정 관리에서 `이 기기 저장 가져오기`를 다시 실행 가능하게 제공
- [x] 계정 팝업을 ARIA menu가 아닌 disclosure navigation 패턴으로 정리
- [x] 로그인·회원가입 비밀번호 표시/숨김 제공
- [x] 회원가입 비밀번호 확인과 불일치 검증 제공

### 별도 인프라가 필요한 후속 작업

- [ ] 이메일 비밀번호 재설정
  - 메일 발송, 일회용 토큰, 만료·재사용 방지, 계정 존재 여부 비노출 API가 먼저 필요하다.
  - 백엔드 계약 없이 성공한 것처럼 보이는 프론트 전용 화면은 만들지 않는다.

### 후속 리팩터링

- [ ] 전체 버튼 variant(`primary`, `secondary`, `danger`) 컴포넌트화
  - 이번 변경에서는 관련 화면의 상태만 맞추고, 전역 기계적 교체는 별도 PR로 분리한다.

### Skiper UI 참고 시각 개선

- [x] 새 UI 프레임워크 없이 기존 React·Tailwind 구조 유지
- [x] 홈 hero를 비대칭 글래스 패널과 이미지 reveal 구조로 개선
- [x] 도감 카드에 사진 중심 hover·focus lift와 미세 확대 적용
- [x] 월 선택 rail에 native scroll snap과 선택 상태 모션 적용
- [x] 월별 결과 변경 시 이전 데이터 유지와 짧은 진입 전환 결합
- [x] 상세 갤러리에 선택 이미지 reveal과 현재 이미지 위치 표시
- [x] 모든 신규 모션에 `prefers-reduced-motion` 대체 상태 제공
- [x] 전용 FishNote SVG 마크를 header·footer·favicon에 통일
- [x] desktop 현재 메뉴에 움직이는 active underline 적용
- [x] 검색 surface의 focus·press 피드백 정리
- [x] 캘린더에 대표 제철 기준과 정보 출처 진입점 제공
- [x] 정보 출처 화면에 정적 월 데이터와 공공자료 교차 검수 방법 설명

## 3. 설계 결정

### 3.1 모바일 header

- 모바일에서 검색 행을 `absolute`로 띄우지 않는다.
- header 안의 두 번째 행으로 렌더링하여 본문을 가리지 않게 한다.
- `--app-header-height`, `--app-scroll-offset` 토큰을 상세 sticky nav와 anchor에 공유한다.
- 홈 hero 관찰 결과로 검색 행이 열릴 때 높이 변화가 생기더라도 콘텐츠 가림보다
  예측 가능한 문서 흐름을 우선한다.

### 3.2 검색 pagination

- `getFishCatalogPage()`는 `items`, `pageInfo`, `facets`를 유지한다.
- 기존 전체 목록 소비자는 `getFishList()` 호환 경로를 유지한다.
- 검색 화면만 cursor 기반 infinite query를 사용한다.
- 자동 무한 스크롤 대신 명시적 `결과 더 보기` 버튼을 사용한다.
  사용자가 현재 위치와 로딩 시점을 통제할 수 있고 키보드 접근도 단순하다.
- v1 fallback에는 다음 cursor가 없으므로 한 페이지 완료 상태로 취급한다.

### 3.3 전환 상태

- 최초 진입은 기존 skeleton을 유지한다.
- 필터·정렬·월 변경은 이전 결과를 유지하고 `aria-busy`와 작은 갱신 문구를 제공한다.
- 기존 카드 위치를 유지하여 레이아웃 점프와 재탐색 비용을 줄인다.

### 3.4 북마크

- 낙관적 UI는 유지하되 성공 토스트는 서버 응답 이후에만 노출한다.
- 실패하면 해당 횟감만 원래 상태로 복원하고 실패 토스트를 표시한다.
- 다른 횟감의 저장 버튼은 잠그지 않는다.

### 3.5 상세 로컬 내비게이션

- 실제 본문 순서와 같은 `맛·제철`, `가격`, `즐기는 법`, `근거`, `후기` 순서를 제공한다.
- 현재 보이는 섹션을 `aria-current="location"`으로 알린다.
- `prefers-reduced-motion`에서는 부드러운 스크롤을 사용하지 않는다.

### 3.6 Skiper UI 참고 원칙

- 컴포넌트 구현을 복사하거나 shadcn 구조로 마이그레이션하지 않는다.
- 정보 탐색보다 모션이 앞서지 않도록 hero·카드·월 전환·갤러리에만 적용한다.
- 전환은 `transform`과 `opacity`를 우선하며 공통 easing token을 사용한다.
- 커서 트레일, 과한 3D 효과, 모바일 내비게이션과 충돌하는 dynamic island는 사용하지 않는다.

## 4. 검증 결과

- [x] Vitest 49개 파일, 261개 테스트 통과
- [x] ESLint 전체 통과
- [x] `tsc -b`와 Vite production build 성공
- [x] 320×568 직접 시각 점검
  - header 65px 아래에서 hero가 끝나며 첫 화면에 다음 제철 섹션과 카드 시작점 노출
  - 문서 가로폭 320px, viewport 320px로 가로 overflow 없음
  - 짧은 화면에서 빠른 태그 보조 라벨을 숨기고 태그 4개를 한 줄로 유지
- [x] 서로 다른 두 횟감의 독립 pending, 응답 전 성공 토스트 미노출, 실패 원복 테스트
- [x] cursor 전달 및 2페이지 병합 시 중복 제거 테스트
- [x] 계정 병합 재진입, 비밀번호 확인·표시, 상세 route 회귀 테스트
- [ ] Playwright 반응형 suite
  - 코드 실패가 아니라 현재 로컬에 Playwright `chromium_headless_shell-1228` 실행 파일이 없어 시작 전 중단됨
  - 동일 320px 홈은 Codex 인앱 브라우저로 직접 확인함

### Skiper UI 참고 개선 검증

- [x] 카드·갤러리·캘린더 관련 Vitest 3개 파일, 14개 테스트 통과
- [x] 변경 TSX 대상 ESLint 통과
- [x] 제한된 정상 type package를 지정한 `tsc --noEmit` 통과
- [x] Vite production bundle 성공
- [x] 26개 어종 상세와 고정 페이지 4개의 prerender 및 sitemap 생성 성공
- [x] 320×568, 390×844, 1440×900 라이트·다크 화면 직접 확인
- [x] 320px·390px에서 문서 가로 overflow 없음
- [x] 브라우저 콘솔 오류 없음
- [x] 브랜드·검색·제철 기준 관련 Vitest 4개 파일, 11개 테스트 통과
- [x] 새 마크의 중복 낭독 방지와 캘린더 기준 안내의 landmark·링크 검증
- [x] 390×844 및 1440×900에서 브랜드 마크·active nav·제철 안내 직접 확인
- [x] 통합 `npm run build`
  - TypeScript 전역 타입을 `node`로 명시해 로컬 `node_modules/@types`의 중복 디렉터리를
    암시적 타입 라이브러리로 읽지 않게 했다.
  - seed catalog 검사, `tsc -b`, Vite production bundle, prerender가 한 명령에서 모두 통과한다.

## 5. 감사에서 유지할 강점

- Pretendard 기반 한글 타이포와 단일 teal accent
- light/dark 색 토큰과 대비 테스트
- 44px 이상의 주요 터치 영역
- skip link, route focus/announcement, reduced-motion 대응
- loading·empty·error·retry 상태
- 모바일 상세에서 이름·제철·가격을 사진보다 먼저 보여주는 순서
- 사진·정보 출처와 검수 상태 공개
