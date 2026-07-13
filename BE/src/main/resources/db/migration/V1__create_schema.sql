-- FishNote 스키마 (PostgreSQL)
-- docs/01_DB설계.md 의 DDL 그대로. 재기동 시 안전하도록 IF NOT EXISTS 추가.
-- Flyway가 스키마를 변경하고 Hibernate ddl-auto=validate가 엔티티 매핑을 검증한다.

-- 생선
CREATE TABLE IF NOT EXISTS fish (
    id          BIGSERIAL PRIMARY KEY,
    name        VARCHAR(100) NOT NULL,
    name_en     VARCHAR(100),
    image_url   TEXT,
    taste_desc  TEXT,
    price_level SMALLINT CHECK (price_level BETWEEN 1 AND 3),
    featured    BOOLEAN NOT NULL DEFAULT false,
    description TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ
);

ALTER TABLE fish ADD COLUMN IF NOT EXISTS featured BOOLEAN NOT NULL DEFAULT false;

-- 회원
CREATE TABLE IF NOT EXISTS users (
    id            BIGSERIAL PRIMARY KEY,
    email         VARCHAR(255) NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    nickname      VARCHAR(30) NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_bookmark (
    user_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    fish_id    BIGINT NOT NULL REFERENCES fish(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, fish_id)
);

-- 제철 월
CREATE TABLE IF NOT EXISTS fish_season_month (
    fish_id BIGINT NOT NULL REFERENCES fish(id) ON DELETE CASCADE,
    month   SMALLINT NOT NULL CHECK (month BETWEEN 1 AND 12),
    PRIMARY KEY (fish_id, month)
);

-- 맛 태그
CREATE TABLE IF NOT EXISTS fish_taste_tag (
    fish_id BIGINT NOT NULL REFERENCES fish(id) ON DELETE CASCADE,
    tag     VARCHAR(30) NOT NULL,
    PRIMARY KEY (fish_id, tag)
);

-- 추가 이미지(갤러리)
CREATE TABLE IF NOT EXISTS fish_image (
    fish_id     BIGINT NOT NULL REFERENCES fish(id) ON DELETE CASCADE,
    image_order INTEGER NOT NULL,
    url         TEXT NOT NULL,
    PRIMARY KEY (fish_id, image_order)
);

-- 비슷한 생선 (self many-to-many)
CREATE TABLE IF NOT EXISTS fish_similar (
    fish_id         BIGINT NOT NULL REFERENCES fish(id) ON DELETE CASCADE,
    similar_fish_id BIGINT NOT NULL REFERENCES fish(id) ON DELETE CASCADE,
    PRIMARY KEY (fish_id, similar_fish_id),
    CHECK (fish_id <> similar_fish_id)
);

-- 이렇게 즐겨요 팁
CREATE TABLE IF NOT EXISTS fish_tip (
    fish_id   BIGINT NOT NULL REFERENCES fish(id) ON DELETE CASCADE,
    tip_order INTEGER NOT NULL,
    content   TEXT NOT NULL,
    PRIMARY KEY (fish_id, tip_order)
);

-- 노량진 경매/도매 시세 관측값
CREATE TABLE IF NOT EXISTS market_price_observation (
    id                     BIGSERIAL PRIMARY KEY,
    fish_id                BIGINT REFERENCES fish(id) ON DELETE SET NULL,
    source                 VARCHAR(50) NOT NULL,
    market                 VARCHAR(100) NOT NULL,
    observed_date          DATE NOT NULL,
    canonical_fish_name    VARCHAR(100),
    noryangjin_species_name VARCHAR(100) NOT NULL,
    source_species_name    VARCHAR(100) NOT NULL,
    trade_state            VARCHAR(20),
    origin                 VARCHAR(100),
    spec                   VARCHAR(100),
    package_unit           VARCHAR(50),
    quantity               NUMERIC(12, 2),
    weight                 NUMERIC(12, 2),
    high_price_krw         INTEGER,
    low_price_krw          INTEGER,
    avg_price_krw          INTEGER,
    source_url             TEXT,
    collected_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_market_price_observation UNIQUE (
        source,
        market,
        observed_date,
        source_species_name,
        origin,
        spec,
        package_unit,
        quantity,
        weight,
        high_price_krw,
        low_price_krw,
        avg_price_krw
    )
);

-- 상회/카톡방/수동 입력 기반 시세 관측값
CREATE TABLE IF NOT EXISTS shop_price_observation (
    id                  BIGSERIAL PRIMARY KEY,
    fish_id             BIGINT REFERENCES fish(id) ON DELETE SET NULL,
    observed_at         TIMESTAMPTZ NOT NULL,
    source_type         VARCHAR(50) NOT NULL,
    source_name         VARCHAR(100),
    speaker             VARCHAR(100),
    canonical_fish_name VARCHAR(100),
    reported_name       VARCHAR(100) NOT NULL,
    condition           VARCHAR(50),
    origin              VARCHAR(100),
    size_grade          VARCHAR(100),
    unit                VARCHAR(30),
    price_min_krw       INTEGER NOT NULL,
    price_max_krw       INTEGER NOT NULL,
    confidence          NUMERIC(3, 2) NOT NULL DEFAULT 0.5,
    raw_text            TEXT NOT NULL,
    collected_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_shop_price_observation UNIQUE (
        observed_at,
        source_type,
        source_name,
        reported_name,
        price_min_krw,
        price_max_krw,
        raw_text
    )
);

-- 후기
CREATE TABLE IF NOT EXISTS review (
    id         BIGSERIAL PRIMARY KEY,
    fish_id    BIGINT NOT NULL REFERENCES fish(id) ON DELETE CASCADE,
    nickname   VARCHAR(30) NOT NULL,
    rating     SMALLINT CHECK (rating BETWEEN 1 AND 5),
    content    TEXT NOT NULL,
    image_url  TEXT,
    password_hash VARCHAR(100),
    user_id    BIGINT REFERENCES users(id) ON DELETE SET NULL,
    helpful_count INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE review ADD COLUMN IF NOT EXISTS password_hash VARCHAR(100) NOT NULL DEFAULT '';
ALTER TABLE review ALTER COLUMN password_hash DROP NOT NULL;
ALTER TABLE review ALTER COLUMN password_hash DROP DEFAULT;
ALTER TABLE review ADD COLUMN IF NOT EXISTS user_id BIGINT REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE review ADD COLUMN IF NOT EXISTS helpful_count INT NOT NULL DEFAULT 0;

-- 후기 도움돼요 중복 방지 (회원 또는 익명 IP 해시 기준)
CREATE TABLE IF NOT EXISTS review_helpful_vote (
    id         BIGSERIAL PRIMARY KEY,
    review_id  BIGINT NOT NULL REFERENCES review(id) ON DELETE CASCADE,
    voter_key  VARCHAR(64) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_review_helpful_vote UNIQUE (review_id, voter_key)
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_review_fish ON review(fish_id);
CREATE INDEX IF NOT EXISTS idx_review_helpful_vote_review ON review_helpful_vote(review_id);
CREATE INDEX IF NOT EXISTS idx_season_month ON fish_season_month(month);
CREATE INDEX IF NOT EXISTS idx_taste_tag ON fish_taste_tag(tag);
CREATE INDEX IF NOT EXISTS idx_fish_name ON fish(name);
CREATE INDEX IF NOT EXISTS idx_user_bookmark_user_created ON user_bookmark(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_market_price_fish_date ON market_price_observation(fish_id, observed_date DESC);
CREATE INDEX IF NOT EXISTS idx_market_price_species_date ON market_price_observation(noryangjin_species_name, observed_date DESC);
CREATE INDEX IF NOT EXISTS idx_shop_price_fish_observed ON shop_price_observation(fish_id, observed_at DESC);
CREATE INDEX IF NOT EXISTS idx_shop_price_name_observed ON shop_price_observation(canonical_fish_name, observed_at DESC);
