# FishNote — REST API 명세서

> Base URL: `/api/v1`, `/api/v2`  ·  Content-Type: `application/json`
> §2~§9는 v1 초기 계약의 이력이고, Phase 5의 additive 현행 계약은 §10 이후를 함께 적용한다.
> 모든 응답은 DTO 기반 JSON. 에러는 §7·§15 표준 포맷.

---

## 1. 엔드포인트 요약

| 메서드 | 경로 | 설명 |
|---|---|---|
| GET | `/fish` | 생선 목록 (검색·필터·정렬) |
| GET | `/fish/{id}` | 생선 상세 (제철·맛·비슷한생선·후기요약 포함) |
| GET | `/fish/{id}/prices` | 특정 생선의 최근 상회 시세 |
| GET | `/fish/{id}/reviews` | 특정 생선 후기 목록 |
| POST | `/fish/{id}/reviews` | 후기 작성 |
| DELETE | `/reviews/{id}` | 후기 삭제 (비밀번호 확인) |
| POST | `/reviews/{id}/helpful` | 도움돼요 (회원 또는 익명 식별자별 1회) |
| DELETE | `/auth/me` | 현재 비밀번호 확인 후 회원 탈퇴 |
| POST | `/auth/kakao` | 카카오 인가 코드 교환 후 FishNote JWT 발급 |
| GET/POST | `/me/tastings` | 회원 전용 먹어본 기록 조회·작성 |
| PUT/DELETE | `/me/tastings/{id}` | 본인 먹어본 기록 수정·삭제 |
| GET | `/fish/suggestions` | 이름·영문명·시장 별칭 자동완성 |
| GET | `/fish/{id|slug}/sources` | 주장별 출처·검증 상태 |
| POST | `/fish/{id}/corrections` | 오류 제보(202) |
| GET | `/home` | 홈 seasonal/featured/catalog/facets 통합 |
| GET | `/api/v2/fish` | cursor 목록·facets·alias 검색 |
| GET | `/api/v2/fish/{id|slug}` | projection 기반 상세 |
| GET | `/api/v2/fish/{id}/reviews` | cursor 후기·선택 summary |
| GET | `/admin/overview` | 관리자 운영 지표·최근 작업 |
| GET/POST/PUT | `/admin/fishes[/{id}]` | 관리자 도감 목록·등록·수정 |
| GET/PATCH | `/admin/corrections[/{id}]` | 관리자 오류 제보 목록·상태 변경 |
| GET/DELETE | `/admin/reviews[/{id}]` | 관리자 최근 후기 목록·삭제 |
| GET | `/actuator/health/liveness` | 프로세스 liveness |
| GET | `/actuator/health/readiness` | DB 포함 readiness |

---

## 2. GET /fish — 목록

쿼리 파라미터 (모두 선택):
| 파라미터 | 타입 | 설명 |
|---|---|---|
| `search` | string | 이름 부분일치 |
| `season` | string | `spring`/`summer`/`fall`/`winter` |
| `taste` | string | 맛 태그 (예: 담백) |
| `priceLevel` | int | 1~3 |
| `sort` | string | `popular`(기본) / `name` |

응답 200:
```json
[
  {
    "id": 1,
    "name": "광어",
    "imageUrl": "https://.../gwangeo.jpg",
    "description": "담백하고 쫄깃한 국민 흰살회",
    "priceLevel": 2,
    "tasteTags": ["담백", "쫄깃"],
    "seasonMonths": [11, 12, 1, 2],
    "avgRating": 4.3,
    "reviewCount": 12
  }
]
```
> 목록은 요약 DTO(`FishSummaryResponse`). `avgRating`/`reviewCount`는 집계값.

---

## 3. GET /fish/{id} — 상세

응답 200:
```json
{
  "id": 1,
  "name": "광어",
  "nameEn": "Olive flounder",
  "imageUrl": "https://.../gwangeo.jpg",
  "description": "국민 흰살생선 회",
  "tasteDesc": "담백하고 쫄깃한 식감. 회 입문자에게 무난.",
  "tasteTags": ["담백", "쫄깃"],
  "seasonMonths": [11, 12, 1, 2],
  "priceLevel": 2,
  "avgRating": 4.3,
  "reviewCount": 12,
  "similarFishes": [
    { "id": 3, "name": "우럭", "imageUrl": "https://.../urok.jpg" },
    { "id": 6, "name": "도미", "imageUrl": "https://.../domi.jpg" }
  ]
}
```
- 없는 id → 404 (§6)

---

## 3-1. GET /fish/{id}/prices — 최근 시세

쿼리(선택): `days`(기본 14, 서버에서 1~30 범위로 보정)

응답 200:
```json
{
  "fishId": 1,
  "days": 14,
  "observationCount": 2,
  "latest": {
    "observedAt": "2026-07-13T08:00:00+09:00",
    "priceMinKrw": 31000,
    "priceMaxKrw": 33000,
    "unit": "kg",
    "origin": "제주",
    "sizeGrade": "2.4~2.5kg",
    "sourceLabel": "상회 시세"
  },
  "recent": [
    {
      "observedAt": "2026-07-13T08:00:00+09:00",
      "priceMinKrw": 31000,
      "priceMaxKrw": 33000,
      "unit": "kg",
      "origin": "제주",
      "sizeGrade": "2.4~2.5kg",
      "sourceLabel": "상회 시세"
    }
  ]
}
```

- 관측값이 없으면 `latest`는 `null`, `recent`는 빈 배열이다.
- 검수용 `rawText`, `speaker`, `sourceName`, 원문 어종명은 공개 응답에서 제외한다.
- 없는 생선 id → 404 (§6)

---

## 4. GET /fish/{id}/reviews — 후기 목록

쿼리(선택): `page`(기본 0), `size`(기본 20), `sort`=`latest`(기본)

응답 200:
```json
{
  "fishId": 1,
  "avgRating": 4.3,
  "totalCount": 12,
  "page": 0,
  "size": 20,
  "hasNext": false,
  "reviews": [
    {
      "id": 101,
      "nickname": "회러버",
      "rating": 5,
      "content": "쫄깃하고 최고예요",
      "imageUrl": null,
      "createdAt": "2026-07-01T12:30:00Z"
    }
  ]
}
```

---

## 5. POST /fish/{id}/reviews — 후기 작성

요청 body:
```json
{
  "nickname": "회러버",
  "rating": 5,
  "content": "쫄깃하고 최고예요",
  "imageUrl": null,
  "password": "1234"
}
```
검증 규칙:
- `nickname`: 필수, 1~30자
- `rating`: 선택, 1~5
- `content`: 필수, 1~1000자
- `password`: 필수, 4~20자 (삭제용, 해시 저장)

응답 201:
```json
{ "id": 101, "fishId": 1, "nickname": "회러버", "rating": 5, "content": "쫄깃하고 최고예요", "imageUrl": null, "createdAt": "2026-07-01T12:30:00Z" }
```
- 검증 실패 → 400 (§6)

---

## 6. DELETE /reviews/{id} — 후기 삭제

요청 body:
```json
{ "password": "1234" }
```
- 비밀번호 일치 → 204 No Content
- 불일치 → 403
- 없는 id → 404

---

## 7. 표준 에러 응답

```json
{
  "timestamp": "2026-07-01T12:30:00Z",
  "status": 400,
  "error": "Bad Request",
  "code": "VALIDATION_FAILED",
  "message": "content는 필수입니다.",
  "fieldErrors": { "content": "content는 필수입니다." },
  "traceId": "8f97...",
  "path": "/api/v1/fish/1/reviews"
}
```

| 상황 | 코드 |
|---|---|
| 검증 실패 | 400 |
| 비밀번호 불일치 | 403 |
| 리소스 없음 | 404 |
| 서버 오류 | 500 |

> 전역 처리: `@RestControllerAdvice` + `@ExceptionHandler`.

---

## 8. 설계 메모
- 목록=요약 DTO / 상세=풀 DTO로 분리해 페이로드 최적화.
- `avgRating`·`reviewCount`는 쿼리 집계(`@Query` 또는 JPQL). 초기엔 단순 계산, 트래픽 늘면 캐싱.
- `season` 파라미터(spring/…)는 BE에서 월 범위로 매핑 (봄=3~5, 여름=6~8, 가을=9~11, 겨울=12~2).

---

## 9. v1 확장 (디자인 시안 반영)

### 9-1. `GET /fish` 파라미터 추가
| 파라미터 | 타입 | 설명 |
|---|---|---|
| `month` | int (1~12) | 해당 월이 제철인 생선만 (제철 캘린더용) |
| `featured` | boolean | true면 EDITOR'S PICK만 |

`FishSummaryResponse`에 `featured` 필드 추가:
```json
{ "...": "...", "featured": true }
```

### 9-2. `GET /fish/{id}` 상세 응답 필드 추가
```json
{
  "...": "...(기존 필드)",
  "images": ["https://.../1.jpg", "https://.../2.jpg"],
  "tips": ["살짝 숙성하면 단맛이 올라와요", "초장보다 간장+고추냉이 추천"],
  "ratingDistribution": { "5": 7, "4": 3, "3": 1, "2": 0, "1": 1 }
}
```
- `images`: 갤러리(대표 이미지 포함, 순서대로). 없으면 `[imageUrl]`.
- `tips`: "이렇게 즐겨요" 항목(순서 보존).
- `ratingDistribution`: 별점별 후기 수(1~5).

### 9-3. `GET /fish/{id}/reviews` 변경
- 정렬 파라미터 `sort` 추가: `latest`(기본) / `helpful`.
- 응답에 `ratingDistribution` 추가, 각 리뷰에 `helpfulCount` 추가:
```json
{
  "fishId": 1, "avgRating": 4.3, "totalCount": 12,
  "ratingDistribution": { "5": 7, "4": 3, "3": 1, "2": 0, "1": 1 },
  "reviews": [
    { "id": 101, "nickname": "회러버", "rating": 5, "content": "...", "imageUrl": null, "helpfulCount": 4, "createdAt": "2026-07-01T12:30:00Z" }
  ]
}
```

### 9-4. `POST /reviews/{id}/helpful` — 도움돼요
- 최초 요청일 때만 helpful_count를 1 증가한다.
- 회원은 사용자 ID, 비회원은 IP를 서버에서 해시한 값으로 중복을 방지한다.
- 응답 200:
```json
{ "id": 101, "helpfulCount": 5 }
```

### 9-5. 저장(북마크) — 비회원 fallback + 회원 API
- 비회원은 기존처럼 프론트 `localStorage`에 저장한다.
- 회원은 `/api/v1/me/bookmarks`를 사용하고 로그인 직후 `POST /me/bookmarks/merge`로 localStorage를
  서버에 병합한다. 세부 계약은 §14와 `docs/09_인증_내도감_설계.md`를 따른다.

### 9-6. 인기 검색 태그(히어로)
- 백엔드 불필요. 프론트 정적 목록(예: 광어, 방어, 연어, 참돔).

---

## 10. 현행 Fish read API

### 10-1. v1 additive 필드와 identifier

`GET /api/v1/fish` 배열 계약은 유지한다. summary에는 기존 필드 외에 다음이 추가됐다.

```json
{
  "id": 1,
  "slug": "gwangeo",
  "category": "FISH",
  "name": "광어",
  "media": {
    "id": "1",
    "url": "https://...",
    "width": 4032,
    "height": 3024,
    "alt": "수족관 바닥에 몸을 붙이고 있는 광어 한 마리",
    "role": "PRIMARY",
    "credit": "Totti",
    "sourceUrl": "https://commons.wikimedia.org/...",
    "license": "CC BY-SA 4.0",
    "focalPoint": { "x": 0.5, "y": 0.57 },
    "blurDataUrl": null
  },
  "imageUrl": "https://...",
  "reviewCount": 12,
  "ratingCount": 10,
  "avgRating": 4.3
}
```

`GET /api/v1/fish/{identifier}`와 v2 detail의 `identifier`는 숫자 ID 또는 slug다. detail에는
`scientificName`, `aliases`, `media`, `galleryMedia`, `ratingCount`가 additive하게 포함되며,
`imageUrl`·`images`는 구 FE fallback을 위해 유지한다. `ratingCount=0`이면 `reviewCount>0`이어도
별점 평균을 평점처럼 노출하지 않는다.

### 10-2. `GET /api/v2/fish`

쿼리:

| 파라미터 | 기본/범위 | 설명 |
|---|---|---|
| `search` | 선택 | 이름·영문명·별칭 검색 |
| `season` | 선택 | `spring/summer/fall/autumn/winter` |
| `taste` | 선택 | 맛 태그 |
| `priceLevel` | 선택, 1~3 | 가격대 |
| `month` | 선택, 1~12 | 제철 월 |
| `featured` | 선택 | 규칙형 추천 대상 |
| `category` | 선택 | `FISH/SHELLFISH/CEPHALOPOD` |
| `sort` | `popular` | `popular` 또는 `name` |
| `limit` | 24, 1~100 | page 크기 |
| `cursor` | 선택 | 직전 응답의 opaque Base64URL cursor |

```json
{
  "items": [],
  "pageInfo": {
    "nextCursor": "eyJ2ZXJzaW9uIjoxLC4uLn0",
    "hasNext": true,
    "limit": 24
  },
  "facets": {
    "taste": { "담백": 10 },
    "season": { "winter": 8 },
    "priceLevel": { "1": 5, "2": 12, "3": 9 },
    "category": { "FISH": 25, "SHELLFISH": 1 }
  }
}
```

cursor는 정렬 기준과 version을 포함하며 클라이언트가 해석하거나 수정하지 않는다. 형식 오류,
다른 sort의 cursor 재사용, 필수 위치값 누락은 400 `INVALID_CURSOR`다.

### 10-3. `GET /api/v1/fish/suggestions`

`q`는 필수, `limit`은 기본 8이다. 공백을 정규화하고 이름·영문명·별칭을 점수화한다.

```json
{
  "items": [
    {
      "id": 1,
      "slug": "gwangeo",
      "name": "광어",
      "matchedAlias": "넙치",
      "thumbnail": "https://..."
    }
  ]
}
```

## 11. Review v2 cursor API

```http
GET /api/v2/fish/{fishId}/reviews
    ?sort=latest|helpful
    &limit=20
    &cursor=...
    &includeSummary=true|false
```

- `limit`: 1~100
- 첫 page는 `includeSummary=true`로 summary+items를 읽는다.
- 다음 page는 `includeSummary=false`로 보내면 summary가 `null`이고 cursor 목록만 읽는다.
- `latest` cursor: `(createdAt,id)`, `helpful` cursor: `(helpfulCount,createdAt,id)`
- 로그인 요청의 item에는 요청자 기준 `mine`이 포함된다.
- 사용자별 `mine`/helpful 상태가 있으므로 응답은 `private, no-store`다.

```json
{
  "fishId": 1,
  "summary": {
    "avgRating": 4.3,
    "reviewCount": 12,
    "ratingCount": 10,
    "ratingDistribution": { "1": 0, "2": 0, "3": 1, "4": 5, "5": 4 }
  },
  "items": [],
  "pageInfo": { "nextCursor": null, "hasNext": false, "limit": 20 }
}
```

## 12. 출처·오류 제보

### 12-1. `GET /api/v1/fish/{id|slug}/sources`

claim 순서는 `IDENTITY`, `SEASON`, `TASTE`, `PRICE`, `PHOTO`다. 출처가 없는 claim도 생략하지
않고 `UNVERIFIED`, `sourceCount=0`, 빈 `sources`로 반환한다.

```json
{
  "fishId": 1,
  "fishName": "광어",
  "summary": {
    "verificationStatus": "VERIFIED",
    "lastVerifiedAt": "2026-07-23T00:00:00+09:00",
    "sourceCount": 1
  },
  "claims": [
    {
      "claimType": "PHOTO",
      "verificationStatus": "VERIFIED",
      "lastVerifiedAt": "2026-07-23T00:00:00+09:00",
      "sourceCount": 1,
      "sources": [
        {
          "id": 7,
          "claimType": "PHOTO",
          "publisher": "Wikimedia Commons",
          "title": "광어 대표 사진 원문",
          "url": "https://...",
          "publishedAt": null,
          "verifiedAt": "2026-07-23T00:00:00+09:00",
          "license": "CC BY-SA 4.0",
          "confidence": "HIGH"
        }
      ]
    }
  ]
}
```

overall/claim status는 HIGH가 하나 이상이면 `VERIFIED`, 출처는 있으나 HIGH가 없으면
`PARTIALLY_VERIFIED`, 없으면 `UNVERIFIED`다.

### 12-2. `POST /api/v1/fish/{fishId}/corrections`

```json
{
  "claimType": "SEASON",
  "message": "제철 월을 다시 확인해 주세요.",
  "sourceUrl": "https://example.org/evidence"
}
```

- `message`: trim 후 필수, Unicode code point 기준 1~1000자
- `sourceUrl`: 선택, 사용자정보 없는 절대 `http/https`, 최대 2048자
- 성공: 202 `{ "id": 1, "status": "PENDING" }`
- 공개 쓰기이므로 actor/global rate limit과 `private, no-store`를 적용한다.

## 13. 홈·가격 projection

### 13-1. `GET /api/v1/home`

```http
GET /api/v1/home?month=7&sort=popular
```

`month`는 필수 1~12, `sort`는 `popular|name`이다. 현재 26종 catalog 한 page에서 세 섹션을
파생하며 FE 홈은 이 endpoint를 한 번만 호출한다.

```json
{
  "month": 7,
  "generatedAt": "2026-07-23T00:00:00Z",
  "seasonal": [],
  "featured": [],
  "catalog": [],
  "facets": {
    "taste": {}, "season": {}, "priceLevel": {}, "category": {}
  }
}
```

### 13-2. `GET /api/v1/fish/{fishId}/prices`

| 파라미터 | 기본/범위 | 설명 |
|---|---|---|
| `days` | 14, 1~30으로 보정 | 관측 기간 |
| `resolution` | `DAY` | `DAY/WEEK/MONTH` |
| `maxPoints` | 30, 1~200으로 보정 | series 최대 point |
| `variantKey` | 선택, 최대 300자 | 양식/자연산·산지·단위 variant |

응답은 `rawText`·speaker·원문 어종명을 SELECT/직렬화하지 않는 projection이다.

```json
{
  "fishId": 1,
  "days": 14,
  "resolution": "DAY",
  "maxPoints": 30,
  "variantKey": null,
  "asOf": "2026-07-23T08:00:00+09:00",
  "currency": "KRW",
  "normalizedUnit": "kg",
  "sourceCount": 2,
  "noDataReason": null,
  "observationCount": 4,
  "latest": {},
  "recent": [],
  "dailyAverage": [],
  "byShop": [],
  "byVariant": []
}
```

기간 내 관측이 없으면 `NO_OBSERVATIONS_IN_RANGE`, 선택 variant가 없으면
`VARIANT_NOT_FOUND`이고, 두 경우 모두 정상 200 응답 안에서 `latest=null`과 빈 series를 반환한다.

## 14. 북마크 원자 API 보강

`/api/v1/me/bookmarks/**`는 Bearer 인증이 필요하고 `private, no-store`다.

- `PUT /me/bookmarks/{fishId}`: PostgreSQL `INSERT ... SELECT ... ON CONFLICT DO NOTHING`, 204
- `DELETE /me/bookmarks/{fishId}`: 멱등, 204
- `POST /me/bookmarks/merge`: `fishIds` 필수, item은 non-null, 최대 500개

```json
{ "fishIds": [1, 3, 3, 999999] }
```

```json
{ "acceptedCount": 2, "skippedCount": 2 }
```

`acceptedCount`는 존재하는 distinct Fish 수다. `skippedCount`는 전체 입력 수에서 accepted를 뺀
값이므로 존재하지 않는 ID뿐 아니라 중복 입력도 포함한다. 이미 저장된 row도 유효 Fish라 accepted에
포함되며 unique key로 중복 저장하지 않는다.

## 15. 오류·캐시·상태 계약

### 15-1. 오류 코드

표준 body:

```json
{
  "timestamp": "2026-07-23T00:00:00Z",
  "status": 400,
  "error": "Bad Request",
  "code": "INVALID_QUERY_PARAMETER",
  "message": "month는 1~12 사이여야 합니다.",
  "fieldErrors": {},
  "traceId": "8f97...",
  "path": "/api/v1/home"
}
```

| 상황 | HTTP | `code` |
|---|---:|---|
| DTO validation | 400 | `VALIDATION_FAILED` |
| 잘못된 query/path type·값 | 400 | `INVALID_QUERY_PARAMETER` |
| 누락 query | 400 | `MISSING_QUERY_PARAMETER` |
| 읽을 수 없는 JSON | 400 | `INVALID_REQUEST_BODY` |
| cursor 위변조/형식/sort 불일치 | 400 | `INVALID_CURSOR` |
| 지원하지 않는 Content-Type | 415 | `UNSUPPORTED_MEDIA_TYPE` |
| 인증/권한/리소스 | 401/403/404 | `UNAUTHORIZED/FORBIDDEN/NOT_FOUND` |
| 실제 business conflict | 409 | `CONFLICT` |
| flag OFF | 503 | `FEATURE_DISABLED` |
| 처리되지 않은 서버 오류 | 500 | `INTERNAL_SERVER_ERROR` |

429는 같은 trace contract와 `RATE_LIMITED`, `resetAt`을 반환한다. constraint 이름, stack trace,
token, 후기 원문은 응답/일반 로그에 노출하지 않는다. 모든 응답에는 `X-Trace-Id`가 있다.

### 15-2. HTTP/server cache

| 경로군 | HTTP | 서버 Caffeine |
|---|---|---|
| v1/v2 Fish list, `/home` | `public, max-age=60` | catalog 30분/최대 512, home 1분/최대 64 |
| v1/v2 Fish detail | `public, max-age=300` + SHA-256 ETag/304 | detail 5분/최대 256 |
| price | `public, max-age=180` | price 5분/최대 1024 |
| review/auth/me/bookmark/image/correction | `private, no-store` | public cache 없음 |
| 4xx/5xx | `private, no-store` | 해당 없음 |

review mutation commit 후 detail/catalog/home을 무효화하고, price import commit 후 touched Fish의
price key만 무효화한다. 캐시는 process-local 최적화이며 source of truth가 아니다.
`PUBLIC_CACHE_ENABLED=false`면 public 응답도 `no-store`이고 서버 cache는 NoOp이다.

### 15-3. health

- `GET /actuator/health/liveness`: JVM process 상태
- `GET /actuator/health/readiness`: `readinessState,db`; DB 장애 시 503/DOWN
- `GET /api/v1/health`: legacy liveness 안내와 readiness URL만 반환하며 readiness 대용이 아님

운영 배포에서 health 상세는 공개하지 않는다. 실제 readiness·캐시·latency 검증 절차는
[`OPERATIONS.md`](OPERATIONS.md)를 따른다.

### 15-4. 기능 flag

| 환경변수 | OFF 동작 |
|---|---|
| `CATALOG_V2_ENABLED` | `/api/v2/fish/**` 503 `FEATURE_DISABLED` |
| `SOURCES_ENABLED` | `/api/v1/fish/{id|slug}/sources` 503 `FEATURE_DISABLED` |
| `REVIEW_STAT_READ_MODEL_ENABLED` | `fish_review_stat` 대신 live aggregate 사용 |
| `PRICE_IMPORT_BULK_ENABLED` | webhook당 최대 50행의 legacy persist 경로 사용 |
| `PUBLIC_CACHE_ENABLED` | Caffeine는 NoOp, 공개 응답도 `no-store` |

현재 property 기본값은 모두 true다. 점진 배포에서는 코드를 배포하기 전 환경변수를 false로
명시한 뒤 하나씩 전환한다.

## 16. 관리자 API

`/api/v1/admin/**`는 Bearer 인증과 DB의 현재 `users.role=ADMIN`이 모두 필요하다. JWT에는 역할을
고정하지 않으며 요청마다 현재 역할을 읽으므로 운영 중 권한 회수가 즉시 반영된다. 비인증은 401,
일반 회원은 403 `FORBIDDEN`이다.

- `GET /admin/overview`: 횟감·후기·대기 제보·회원 수와 최근 감사 로그 10건
- `GET /admin/fishes`: 이름순 전체 관리 DTO
- `POST /admin/fishes`: 횟감 등록(201)
- `PUT /admin/fishes/{id}`: 횟감 전체 수정
- `GET /admin/corrections?status=PENDING&limit=50`: 제보 최신순 조회
- `PATCH /admin/corrections/{id}`: `PENDING/RESOLVED/REJECTED` 상태 변경
- `GET /admin/reviews?limit=50`: 후기 최신순 조회
- `DELETE /admin/reviews/{id}`: 이미지 정리 대기를 포함한 관리자 삭제(204)

도감 등록·수정, 제보 상태 변경, 후기 삭제는 `admin_audit_log`에 작업자·대상·요약·시각을 남긴다.
도감 수정 commit 후 catalog/detail/home 서버 캐시를 모두 무효화한다. 이름·slug·전역 normalized
별칭 충돌은 409이며, 횟감 물리 삭제 API는 제공하지 않는다.

## 17. 회원 먹어본 기록 API

`/api/v1/me/tastings/**`는 Bearer 인증이 필요하며 모든 조회·수정·삭제는 현재 사용자 소유 범위로
제한한다. 장소와 메모는 공개 후기 응답에 섞지 않는 비공개 데이터다.

- `GET /me/tastings?page=0&size=24`: 먹은 날짜·id 내림차순 페이지와 전체/어종/이번 달 통계
- `POST /me/tastings`: 새 기록 작성(201)
- `PUT /me/tastings/{id}`: 본인 기록 전체 수정
- `DELETE /me/tastings/{id}`: 본인 기록과 연결 사진 삭제 대기 처리(204)

작성·수정 body:

```json
{
  "fishId": 1,
  "tastedOn": "2026-08-06",
  "rating": 5,
  "preparation": "RAW",
  "placeName": "노량진 ○○수산",
  "note": "담백하고 쫄깃했어요",
  "imageUrl": "https://res.cloudinary.com/...",
  "imageAssetId": "ab4fd622-a3b6-45cc-bf73-b1f2ff45b76d"
}
```

`tastedOn`은 오늘 이전, `rating`은 null 또는 1~5, `preparation`은
`RAW/AGED/SEKKOSI/OTHER`다. `placeName`은 100자, `note`는 500자까지 허용한다.
사진은 기존 `POST /images` 업로드 응답의 URL과 자산 id를 함께 전달하며, 서버가 업로더 소유권과
만료 상태를 다시 검증한 뒤 기록에 연결한다.
