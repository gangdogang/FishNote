-- D1 catalog/search expand migration.
-- Slug remains nullable for rolling compatibility with an older writer. Every seeded row is
-- explicitly backfilled and uniqueness is enforced for all non-null values.

ALTER TABLE fish ADD COLUMN slug VARCHAR(120);
ALTER TABLE fish ADD COLUMN category VARCHAR(30) NOT NULL DEFAULT 'FISH';
ALTER TABLE fish ADD COLUMN scientific_name VARCHAR(150);

ALTER TABLE fish
    ADD CONSTRAINT ck_fish_category
    CHECK (category IN ('FISH', 'SHELLFISH', 'CEPHALOPOD'));

UPDATE fish
SET slug = mapping.slug
FROM (VALUES
    (1::BIGINT,  '광어',     'gwangeo'),
    (2::BIGINT,  '방어',     'bangeo'),
    (3::BIGINT,  '우럭',     'ureok'),
    (4::BIGINT,  '참돔',     'chamdom'),
    (5::BIGINT,  '연어',     'yeoneo'),
    (7::BIGINT,  '민어',     'mineo'),
    (8::BIGINT,  '농어',     'nongeo'),
    (9::BIGINT,  '전어',     'jeoneo'),
    (10::BIGINT, '도다리',   'dodari'),
    (11::BIGINT, '감성돔',   'gamseongdom'),
    (12::BIGINT, '돌돔',     'doldom'),
    (13::BIGINT, '병어',     'byeongeo'),
    (14::BIGINT, '갯장어',   'gaetjangeo'),
    (15::BIGINT, '붕장어',   'bungjangeo'),
    (16::BIGINT, '가숭어',   'gasungeo'),
    (17::BIGINT, '고등어',   'godeungeo'),
    (18::BIGINT, '갈치',     'galchi'),
    (19::BIGINT, '숭어',     'sungeo'),
    (20::BIGINT, '가자미',   'gajami'),
    (21::BIGINT, '붉바리',   'bulgbari'),
    (22::BIGINT, '능성어',   'neungseongeo'),
    (23::BIGINT, '자바리',   'jabari'),
    (24::BIGINT, '전복',     'jeonbok'),
    (25::BIGINT, '시마아지', 'shimaaji'),
    (26::BIGINT, '어름돔',   'eoreumdom'),
    (27::BIGINT, '점성어',   'jeomseongeo')
) AS mapping(id, expected_name, slug)
WHERE fish.id = mapping.id
  AND fish.name = mapping.expected_name;

UPDATE fish SET category = 'SHELLFISH' WHERE id = 24 AND name = '전복';

DO $$
BEGIN
    IF (SELECT count(*)
        FROM fish
        WHERE id IN (1, 2, 3, 4, 5, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19,
                     20, 21, 22, 23, 24, 25, 26, 27)) <> 26 THEN
        RAISE EXCEPTION 'One or more expected seeded fish rows are missing';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM fish
        WHERE id IN (1, 2, 3, 4, 5, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19,
                     20, 21, 22, 23, 24, 25, 26, 27)
          AND slug IS NULL
    ) THEN
        RAISE EXCEPTION 'Seeded fish slug mapping is incomplete or an expected name has drifted';
    END IF;

    IF EXISTS (SELECT 1 FROM fish GROUP BY name HAVING count(*) > 1) THEN
        RAISE EXCEPTION 'Duplicate fish names must be resolved before catalog search rollout';
    END IF;

    IF EXISTS (
        SELECT 1 FROM fish WHERE slug IS NOT NULL GROUP BY slug HAVING count(*) > 1
    ) THEN
        RAISE EXCEPTION 'Duplicate fish slugs must be resolved before catalog search rollout';
    END IF;
END
$$;

CREATE UNIQUE INDEX uq_fish_name ON fish(name);
CREATE UNIQUE INDEX uq_fish_slug ON fish(slug);

CREATE TABLE fish_alias (
    id         BIGSERIAL PRIMARY KEY,
    fish_id    BIGINT NOT NULL REFERENCES fish(id) ON DELETE CASCADE,
    alias      VARCHAR(100) NOT NULL,
    alias_type VARCHAR(30) NOT NULL,
    CONSTRAINT ck_fish_alias_type CHECK (alias_type IN ('STANDARD', 'MARKET')),
    CONSTRAINT ck_fish_alias_compact CHECK (alias = regexp_replace(alias, '\s+', '', 'g')),
    CONSTRAINT uq_fish_alias UNIQUE (fish_id, alias)
);

-- Every catalog name is itself a parser/search alias.
INSERT INTO fish_alias (fish_id, alias, alias_type)
SELECT id, name, 'STANDARD'
FROM fish;

-- Preserve the current Java parser behavior for conflicting legacy CSV rows:
-- 부시리/잿방어→방어, 줄돔→돌돔, 돌도다리→도다리.
INSERT INTO fish_alias (fish_id, alias, alias_type)
SELECT fish.id, seed.alias, 'MARKET'
FROM (VALUES
    ('광어', '넙치'),
    ('광어', '찰넙치'),
    ('광어', '찰광어'),
    ('광어', '제주광어'),
    ('방어', '대방어'),
    ('방어', '부시리'),
    ('방어', '잿방어'),
    ('참돔', '도미'),
    ('참돔', '돔'),
    ('농어', '대농어'),
    ('농어', '점농어'),
    ('도다리', '강도다리'),
    ('도다리', '돌도다리'),
    ('돌돔', '줄돔'),
    ('돌돔', '일본줄돔'),
    ('갯장어', '하모'),
    ('붕장어', '아나고'),
    ('가숭어', '참숭어'),
    ('가숭어', '감숭어'),
    ('가숭어', '밀치'),
    ('갈치', '은갈치'),
    ('능성어', '구문쟁이'),
    ('자바리', '대왕자바리'),
    ('전복', '완도전복')
) AS seed(canonical_name, alias)
JOIN fish ON fish.name = seed.canonical_name
ON CONFLICT (fish_id, alias) DO NOTHING;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM fish_alias
        GROUP BY lower(alias)
        HAVING count(DISTINCT fish_id) > 1
    ) THEN
        RAISE EXCEPTION 'A normalized fish alias maps to more than one catalog entry';
    END IF;
END
$$;

-- Aliases are stored compact; parser/search compact input before using this global key.
CREATE UNIQUE INDEX uq_fish_alias_normalized
    ON fish_alias (lower(alias));

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX idx_fish_name_trgm
    ON fish USING gin (lower(name) gin_trgm_ops);

CREATE INDEX idx_fish_name_en_trgm
    ON fish USING gin (lower(name_en) gin_trgm_ops);

CREATE INDEX idx_fish_alias_trgm
    ON fish_alias USING gin (lower(alias) gin_trgm_ops);
