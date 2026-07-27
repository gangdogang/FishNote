-- Additive source seed only. These records link existing season claims to reviewed
-- government-origin pages; they do not copy the source wording into FishNote.

DO $$
BEGIN
    IF (
        SELECT count(*)
        FROM (VALUES
            (8::BIGINT,  '농어'),
            (9::BIGINT,  '전어'),
            (14::BIGINT, '갯장어'),
            (15::BIGINT, '붕장어')
        ) AS expected(id, name)
        JOIN fish ON fish.id = expected.id AND fish.name = expected.name
    ) <> 4 THEN
        RAISE EXCEPTION 'V19 fish_source seed preflight failed: expected fish ID/name mapping has drifted';
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
        8,
        'SEASON',
        '인천광역시 수산자원연구소',
        '2020년 6월 어식백세 수산물 "광어, 농어"',
        'https://www.incheon.go.kr/fish/FI020401/2050291',
        DATE '2020-06-08',
        TIMESTAMPTZ '2026-07-25 00:00:00+00',
        '공공누리 제1유형(출처표시)',
        'HIGH'
    ),
    (
        9,
        'SEASON',
        '인천광역시 수산자원연구소',
        '2024년 9월, 어식백세 수산물 "대하, 전어"',
        'https://www.incheon.go.kr/fish/FI020401/2207048',
        DATE '2024-09-11',
        TIMESTAMPTZ '2026-07-25 00:00:00+00',
        '공공누리 제1유형(출처표시)',
        'HIGH'
    ),
    (
        14,
        'SEASON',
        '인천광역시 수산자원연구소',
        '2024년 8월, 어식백세 수산물 "장어류, 문어"',
        'https://www.incheon.go.kr/fish/FI020401/2203724',
        DATE '2024-08-20',
        TIMESTAMPTZ '2026-07-25 00:00:00+00',
        '공공누리 제1유형(출처표시)',
        'MEDIUM'
    ),
    (
        15,
        'SEASON',
        '인천광역시 수산자원연구소',
        '2024년 8월, 어식백세 수산물 "장어류, 문어"',
        'https://www.incheon.go.kr/fish/FI020401/2203724',
        DATE '2024-08-20',
        TIMESTAMPTZ '2026-07-25 00:00:00+00',
        '공공누리 제1유형(출처표시)',
        'MEDIUM'
    )
ON CONFLICT (fish_id, claim_type, url) DO NOTHING;

DO $$
BEGIN
    IF (
        SELECT count(*)
        FROM fish_source
        WHERE claim_type = 'SEASON'
          AND (
              (fish_id = 8 AND url = 'https://www.incheon.go.kr/fish/FI020401/2050291')
              OR (fish_id = 9 AND url = 'https://www.incheon.go.kr/fish/FI020401/2207048')
              OR (fish_id IN (14, 15) AND url = 'https://www.incheon.go.kr/fish/FI020401/2203724')
          )
    ) <> 4 THEN
        RAISE EXCEPTION 'V19 fish_source seed verification failed';
    END IF;
END
$$;
