-- Generated from config/fish_image_manifest.json by scripts/import_fish_images.mjs.
-- Do not hand-edit media rows. Update the reviewed manifest and regenerate this migration.
-- docs/15 M3: 대표 이미지 핫링크(nifs·wikimedia)를 자체 호스팅 URL로 교체한다.
-- alt·credit·source_url·license·focal point와 fish_source PHOTO 근거는 원본 출처 그대로 유지한다.

DO $$
BEGIN
    IF (
        SELECT count(*)
        FROM (VALUES
            (1, '광어', 'gwangeo'),
            (2, '방어', 'bangeo'),
            (3, '우럭', 'ureok'),
            (4, '참돔', 'chamdom'),
            (5, '연어', 'yeoneo'),
            (7, '민어', 'mineo'),
            (8, '농어', 'nongeo'),
            (9, '전어', 'jeoneo'),
            (10, '도다리', 'dodari'),
            (11, '감성돔', 'gamseongdom'),
            (12, '돌돔', 'doldom'),
            (13, '병어', 'byeongeo'),
            (14, '갯장어', 'gaetjangeo'),
            (15, '붕장어', 'bungjangeo'),
            (16, '가숭어', 'gasungeo'),
            (17, '고등어', 'godeungeo'),
            (18, '갈치', 'galchi'),
            (19, '숭어', 'sungeo'),
            (20, '가자미', 'gajami'),
            (21, '붉바리', 'bulgbari'),
            (22, '능성어', 'neungseongeo'),
            (23, '자바리', 'jabari'),
            (24, '전복', 'jeonbok'),
            (25, '시마아지', 'shimaaji'),
            (26, '어름돔', 'eoreumdom'),
            (27, '점성어', 'jeomseongeo')
        ) AS expected(id, name, slug)
        JOIN fish ON fish.id = expected.id
            AND fish.name = expected.name
            AND fish.slug = expected.slug
    ) <> 26 THEN
        RAISE EXCEPTION 'V22 self-host preflight failed: catalog identity drift';
    END IF;
    IF (
        SELECT count(*)
        FROM fish_image
        WHERE fish_id IN (1, 2, 3, 4, 5, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27)
          AND role = 'PRIMARY'
          AND image_order = 0
    ) <> 26 THEN
        RAISE EXCEPTION 'V22 self-host preflight failed: missing primary media rows';
    END IF;
END
$$;

UPDATE fish_image
SET url = mapping.url,
    width = mapping.width,
    height = mapping.height
FROM (VALUES
    (1, 'https://www.fishnote.kr/fish/gwangeo.jpg', 1280, 960),
    (2, 'https://www.fishnote.kr/fish/bangeo.jpg', 1251, 704),
    (3, 'https://www.fishnote.kr/fish/ureok.jpg', 1280, 720),
    (4, 'https://www.fishnote.kr/fish/chamdom.jpg', 1280, 853),
    (5, 'https://www.fishnote.kr/fish/yeoneo.jpg', 1280, 548),
    (7, 'https://www.fishnote.kr/fish/mineo.jpg', 1280, 653),
    (8, 'https://www.fishnote.kr/fish/nongeo.jpg', 1280, 602),
    (9, 'https://www.fishnote.kr/fish/jeoneo.jpg', 1280, 960),
    (10, 'https://www.fishnote.kr/fish/dodari.jpg', 1280, 866),
    (11, 'https://www.fishnote.kr/fish/gamseongdom.jpg', 1280, 960),
    (12, 'https://www.fishnote.kr/fish/doldom.jpg', 799, 800),
    (13, 'https://www.fishnote.kr/fish/byeongeo.jpg', 1280, 958),
    (14, 'https://www.fishnote.kr/fish/gaetjangeo.jpg', 1280, 708),
    (15, 'https://www.fishnote.kr/fish/bungjangeo.jpg', 1000, 1000),
    (16, 'https://www.fishnote.kr/fish/gasungeo.jpg', 1280, 823),
    (17, 'https://www.fishnote.kr/fish/godeungeo.jpg', 1280, 817),
    (18, 'https://www.fishnote.kr/fish/galchi.jpg', 1280, 960),
    (19, 'https://www.fishnote.kr/fish/sungeo.jpg', 1280, 853),
    (20, 'https://www.fishnote.kr/fish/gajami.jpg', 1280, 861),
    (21, 'https://www.fishnote.kr/fish/bulgbari.jpg', 1280, 1280),
    (22, 'https://www.fishnote.kr/fish/neungseongeo.jpg', 1280, 578),
    (23, 'https://www.fishnote.kr/fish/jabari.jpg', 1280, 960),
    (24, 'https://www.fishnote.kr/fish/jeonbok.jpg', 1280, 890),
    (25, 'https://www.fishnote.kr/fish/shimaaji.jpg', 1280, 832),
    (26, 'https://www.fishnote.kr/fish/eoreumdom.jpg', 640, 480),
    (27, 'https://www.fishnote.kr/fish/jeomseongeo.jpg', 1280, 960)
) AS mapping(fish_id, url, width, height)
WHERE fish_image.fish_id = mapping.fish_id
  AND fish_image.role = 'PRIMARY'
  AND fish_image.image_order = 0;

UPDATE fish
SET image_url = image.url
FROM fish_image image
WHERE image.fish_id = fish.id
  AND image.role = 'PRIMARY'
  AND fish.id IN (1, 2, 3, 4, 5, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27);
