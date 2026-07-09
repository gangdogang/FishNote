-- FishNote 스키마 (PostgreSQL)
-- docs/01_DB설계.md 의 DDL 그대로. 재기동 시 안전하도록 IF NOT EXISTS 추가.
-- spring.jpa.hibernate.ddl-auto=validate 가 이 스키마에 대해 엔티티 매핑을 검증한다.

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
    image_order SMALLINT NOT NULL,
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
    tip_order SMALLINT NOT NULL,
    content   TEXT NOT NULL,
    PRIMARY KEY (fish_id, tip_order)
);

-- 후기
CREATE TABLE IF NOT EXISTS review (
    id         BIGSERIAL PRIMARY KEY,
    fish_id    BIGINT NOT NULL REFERENCES fish(id) ON DELETE CASCADE,
    nickname   VARCHAR(30) NOT NULL,
    rating     SMALLINT CHECK (rating BETWEEN 1 AND 5),
    content    TEXT NOT NULL,
    image_url  TEXT,
    password_hash VARCHAR(100) NOT NULL DEFAULT '',
    helpful_count INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE review ADD COLUMN IF NOT EXISTS password_hash VARCHAR(100) NOT NULL DEFAULT '';
ALTER TABLE review ADD COLUMN IF NOT EXISTS helpful_count INT NOT NULL DEFAULT 0;

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_review_fish ON review(fish_id);
CREATE INDEX IF NOT EXISTS idx_season_month ON fish_season_month(month);
CREATE INDEX IF NOT EXISTS idx_taste_tag ON fish_taste_tag(tag);
CREATE INDEX IF NOT EXISTS idx_fish_name ON fish(name);
