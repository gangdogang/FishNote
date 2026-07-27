-- D2 source/correction expand migration.
-- Source rows are evidence for one claim, not a replacement for the fish detail read model.

CREATE TABLE fish_source (
    id           BIGSERIAL PRIMARY KEY,
    fish_id      BIGINT NOT NULL,
    claim_type   VARCHAR(30) NOT NULL,
    publisher    VARCHAR(150) NOT NULL,
    title        VARCHAR(300) NOT NULL,
    url          TEXT NOT NULL,
    published_at DATE,
    verified_at  TIMESTAMPTZ,
    license      VARCHAR(100),
    confidence   VARCHAR(20) NOT NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT fk_fish_source_fish
        FOREIGN KEY (fish_id) REFERENCES fish(id) ON DELETE CASCADE,
    CONSTRAINT ck_fish_source_claim_type CHECK (
        claim_type IN ('IDENTITY', 'SEASON', 'TASTE', 'PRICE', 'PHOTO')
    ),
    CONSTRAINT ck_fish_source_confidence CHECK (
        confidence IN ('HIGH', 'MEDIUM', 'LOW')
    ),
    CONSTRAINT ck_fish_source_publisher_not_blank CHECK (btrim(publisher) <> ''),
    CONSTRAINT ck_fish_source_title_not_blank CHECK (btrim(title) <> ''),
    CONSTRAINT ck_fish_source_url_http CHECK (url ~ '^https?://[^[:space:]]+$'),
    CONSTRAINT uq_fish_source_claim_url UNIQUE (fish_id, claim_type, url)
);

CREATE TABLE fish_correction_request (
    id          BIGSERIAL PRIMARY KEY,
    fish_id     BIGINT NOT NULL,
    claim_type  VARCHAR(30) NOT NULL,
    message     VARCHAR(1000) NOT NULL,
    source_url  TEXT,
    status      VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    resolved_at TIMESTAMPTZ,
    CONSTRAINT fk_fish_correction_request_fish
        FOREIGN KEY (fish_id) REFERENCES fish(id) ON DELETE CASCADE,
    CONSTRAINT ck_fish_correction_request_claim_type CHECK (
        claim_type IN ('IDENTITY', 'SEASON', 'TASTE', 'PRICE', 'PHOTO')
    ),
    CONSTRAINT ck_fish_correction_request_message_not_blank CHECK (btrim(message) <> ''),
    CONSTRAINT ck_fish_correction_request_source_url_http CHECK (
        source_url IS NULL OR source_url ~ '^https?://[^[:space:]]+$'
    ),
    CONSTRAINT ck_fish_correction_request_status CHECK (
        status IN ('PENDING', 'RESOLVED', 'REJECTED')
    ),
    CONSTRAINT ck_fish_correction_request_resolution CHECK (
        (status = 'PENDING' AND resolved_at IS NULL)
        OR (status IN ('RESOLVED', 'REJECTED') AND resolved_at IS NOT NULL)
    )
);

CREATE INDEX idx_fish_source_fish_claim_verified
    ON fish_source(fish_id, claim_type, verified_at DESC, id);

CREATE INDEX idx_fish_correction_request_fish_created
    ON fish_correction_request(fish_id, created_at DESC, id);

CREATE INDEX idx_fish_correction_request_status_created
    ON fish_correction_request(status, created_at, id);

-- Seed IDs are intentionally guarded by both ID and canonical name. A restored production
-- snapshot with drift must fail before evidence is attached to the wrong catalog entry.
DO $$
BEGIN
    IF (
        SELECT count(*)
        FROM (VALUES
            (3::BIGINT,  '우럭'),
            (7::BIGINT,  '민어'),
            (10::BIGINT, '도다리'),
            (11::BIGINT, '감성돔'),
            (13::BIGINT, '병어'),
            (20::BIGINT, '가자미')
        ) AS expected(id, name)
        JOIN fish ON fish.id = expected.id AND fish.name = expected.name
    ) <> 6 THEN
        RAISE EXCEPTION 'V11 fish_source seed preflight failed: expected fish ID/name mapping has drifted';
    END IF;
END
$$;

INSERT INTO fish_source (
    fish_id,
    claim_type,
    publisher,
    title,
    url,
    published_at,
    verified_at,
    license,
    confidence
)
VALUES
    (
        3,
        'SEASON',
        '인천광역시 수산자원연구소',
        '2026년 5월, 어식백세 수산물 "다시마, 조피볼락"',
        'https://www.incheon.go.kr/fish/FI020401/3070620',
        DATE '2026-05-11',
        TIMESTAMPTZ '2026-07-15 00:00:00+00',
        '공공누리 제1유형(출처표시)',
        'HIGH'
    ),
    (
        7,
        'SEASON',
        '인천광역시 수산자원연구소',
        '2023년 8월, 어식백세 수산물 “민어, 한치"',
        'https://www.incheon.go.kr/fish/FI020401/2142497',
        DATE '2023-08-14',
        TIMESTAMPTZ '2026-07-15 00:00:00+00',
        '공공누리 제1유형(출처표시)',
        'HIGH'
    ),
    (
        10,
        'SEASON',
        '인천광역시 수산자원연구소',
        '2026년 3월, 어식백세 수산물 "도다리, 멍게"',
        'https://www.incheon.go.kr/fish/FI020401/3065118',
        DATE '2026-03-07',
        TIMESTAMPTZ '2026-07-15 00:00:00+00',
        '공공누리 제1유형(출처표시)',
        'HIGH'
    ),
    (
        11,
        'SEASON',
        '인천광역시 수산자원연구소',
        '2024년 10월, 어식백세 수산물 "삼치, 감성돔"',
        'https://www.incheon.go.kr/fish/FI020401/2209903',
        DATE '2024-09-30',
        TIMESTAMPTZ '2026-07-15 00:00:00+00',
        '공공누리 제1유형(출처표시)',
        'HIGH'
    ),
    (
        13,
        'SEASON',
        '인천광역시 수산자원연구소',
        '2023년 6월 어식백세 수산물 “재첩, 병어”',
        'https://www.incheon.go.kr/fish/FI020401/2128808',
        DATE '2023-06-10',
        TIMESTAMPTZ '2026-07-15 00:00:00+00',
        '공공누리 제1유형(출처표시)',
        'HIGH'
    ),
    (
        20,
        'SEASON',
        '인천광역시 수산자원연구소',
        '2026년 4월, 어식백세 수산물 "가자미, 홍어"',
        'https://www.incheon.go.kr/fish/FI020401/3067203',
        DATE '2026-04-03',
        TIMESTAMPTZ '2026-07-15 00:00:00+00',
        '공공누리 제1유형(출처표시)',
        'HIGH'
    );

DO $$
BEGIN
    IF (SELECT count(*) FROM fish_source) <> 6
        OR (SELECT count(DISTINCT fish_id) FROM fish_source) <> 6
        OR (SELECT count(*) FROM fish_source WHERE claim_type = 'SEASON' AND confidence = 'HIGH') <> 6 THEN
        RAISE EXCEPTION 'V11 fish_source seed verification failed: expected exactly six HIGH SEASON sources';
    END IF;
END
$$;
