-- Generated from config/fish_image_manifest.json by scripts/render_fish_image_seed.py.
-- Do not hand-edit media rows. Update the reviewed manifest and regenerate this migration.
-- Coverage at review time: 26 verified primary photos, 0 intentionally blocked.

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
        RAISE EXCEPTION 'V13 fish image seed preflight failed: catalog identity drift';
    END IF;
END
$$;

UPDATE fish
SET scientific_name = mapping.scientific_name
FROM (VALUES
    (1, '광어', 'Paralichthys olivaceus'),
    (2, '방어', 'Seriola quinqueradiata'),
    (3, '우럭', 'Sebastes schlegelii'),
    (4, '참돔', 'Pagrus major'),
    (5, '연어', 'Salmo salar'),
    (7, '민어', 'Miichthys miiuy'),
    (8, '농어', 'Lateolabrax japonicus'),
    (9, '전어', 'Konosirus punctatus'),
    (10, '도다리', 'Pleuronichthys cornutus'),
    (11, '감성돔', 'Acanthopagrus schlegelii'),
    (12, '돌돔', 'Oplegnathus fasciatus'),
    (13, '병어', 'Pampus argenteus'),
    (14, '갯장어', 'Muraenesox cinereus'),
    (15, '붕장어', 'Conger myriaster'),
    (16, '가숭어', 'Planiliza haematocheilus'),
    (17, '고등어', 'Scomber japonicus'),
    (18, '갈치', 'Trichiurus japonicus'),
    (19, '숭어', 'Mugil cephalus'),
    (20, '가자미', 'Pleuronectidae spp.'),
    (21, '붉바리', 'Epinephelus akaara'),
    (22, '능성어', 'Hyporthodus septemfasciatus'),
    (23, '자바리', 'Epinephelus bruneus'),
    (24, '전복', 'Haliotis discus hannai'),
    (25, '시마아지', 'Pseudocaranx dentex'),
    (26, '어름돔', 'Plectorhinchus cinctus'),
    (27, '점성어', 'Sciaenops ocellatus')
) AS mapping(id, expected_name, scientific_name)
WHERE fish.id = mapping.id
  AND fish.name = mapping.expected_name;

-- A primary catalog image is publishable only when it exists in the reviewed manifest.
DELETE FROM fish_image
WHERE fish_id IN (1, 2, 3, 4, 5, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27)
  AND (role = 'PRIMARY' OR image_order = 0);

UPDATE fish
SET image_url = NULL
WHERE id IN (1, 2, 3, 4, 5, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27);

INSERT INTO fish_image (
    fish_id,
    image_order,
    role,
    url,
    width,
    height,
    alt,
    credit,
    source_url,
    license,
    focal_x,
    focal_y
)
VALUES
    (1, 0, 'PRIMARY', 'https://upload.wikimedia.org/wikipedia/commons/f/f0/Paralichthys_olivaceus_Umigatari.jpg', 4032, 3024, '수족관 바닥에 몸을 붙이고 있는 광어 한 마리', 'Totti', 'https://commons.wikimedia.org/wiki/File:Paralichthys_olivaceus_Umigatari.jpg', 'CC BY-SA 4.0', 0.5, 0.57),
    (2, 0, 'PRIMARY', 'https://upload.wikimedia.org/wikipedia/commons/2/28/Japanese_amberjack_by_Vincent_C_Chen.jpg', 1251, 704, '푸른 바다를 헤엄치는 방어 무리', 'Longdongdiver (Vincent C. Chen)', 'https://commons.wikimedia.org/wiki/File:Japanese_amberjack_by_Vincent_C_Chen.jpg', 'CC BY-SA 4.0', 0.52, 0.5),
    (3, 0, 'PRIMARY', 'https://upload.wikimedia.org/wikipedia/commons/d/d9/Sebastes_schlegelii_Muroran.jpg', 4032, 2268, '수족관을 헤엄치는 검은빛 우럭 한 마리', 'Totti', 'https://commons.wikimedia.org/wiki/File:Sebastes_schlegelii_Muroran.jpg', 'CC BY-SA 4.0', 0.51, 0.51),
    (4, 0, 'PRIMARY', 'https://upload.wikimedia.org/wikipedia/commons/b/b6/Pagrus_major_ioworld.jpg', 6000, 4000, '수족관을 헤엄치는 붉은빛 참돔 한 마리', 'タウナギ', 'https://commons.wikimedia.org/wiki/File:Pagrus_major_ioworld.jpg', 'CC0 1.0', 0.5, 0.5),
    (5, 0, 'PRIMARY', 'https://upload.wikimedia.org/wikipedia/commons/2/2e/Salmo_salar_221451741_%28cropped%29.jpg', 1967, 843, '옆모습으로 촬영된 대서양연어 한 마리', 'Ben Rushbrooke', 'https://commons.wikimedia.org/wiki/File:Salmo_salar_221451741_(cropped).jpg', 'CC BY 4.0', 0.5, 0.5),
    (7, 0, 'PRIMARY', 'https://www.nifs.go.kr/cmmn/images/MF0003239_DG0115_watermark.jpg', 1383, 706, '흰 배경에 놓인 은빛 민어 한 마리', '국립수산과학원', 'https://www.nifs.go.kr/contents/actionContentsCons0088.do', '공공누리 제1유형(출처표시)', 0.5, 0.5),
    (8, 0, 'PRIMARY', 'https://upload.wikimedia.org/wikipedia/commons/b/b2/Lateolabrax_japonicus_Iwaki.jpg', 3601, 1695, '수족관을 헤엄치는 은빛 농어 한 마리', 'Totti', 'https://commons.wikimedia.org/wiki/File:Lateolabrax_japonicus_Iwaki.jpg', 'CC BY-SA 4.0', 0.51, 0.5),
    (9, 0, 'PRIMARY', 'https://upload.wikimedia.org/wikipedia/commons/e/e7/Konosirus_punctatus.JPG', 2272, 1704, '옆으로 놓인 은빛 전어 한 마리', '四葉亭四迷', 'https://commons.wikimedia.org/wiki/File:Konosirus_punctatus.JPG', 'CC BY-SA 4.0', 0.5, 0.52),
    (10, 0, 'PRIMARY', 'https://upload.wikimedia.org/wikipedia/commons/1/16/Pleuronichthys_cornutus_at_Osaka_aquarium.jpg', 3767, 2549, '수족관 바닥에 붙어 있는 도다리 한 마리', 'Syrio', 'https://commons.wikimedia.org/wiki/File:Pleuronichthys_cornutus_at_Osaka_aquarium.jpg', 'CC BY-SA 4.0', 0.5, 0.58),
    (11, 0, 'PRIMARY', 'https://upload.wikimedia.org/wikipedia/commons/5/5c/Acanthopagrus_schlegelii.JPG', 3648, 2736, '낚시로 잡은 검은빛 감성돔 한 마리', 'TMDSA', 'https://commons.wikimedia.org/wiki/File:Acanthopagrus_schlegelii.JPG', 'CC BY-SA 3.0', 0.49, 0.53),
    (12, 0, 'PRIMARY', 'https://upload.wikimedia.org/wikipedia/commons/a/aa/Striped_beakfish_Oplegnathus_fasciatus.jpg', 799, 800, '검은 세로줄 무늬가 선명한 돌돔 한 마리', 'OpenCage', 'https://commons.wikimedia.org/wiki/File:Striped_beakfish_Oplegnathus_fasciatus.jpg', 'CC BY-SA 3.0', 0.5, 0.5),
    (13, 0, 'PRIMARY', 'https://upload.wikimedia.org/wikipedia/commons/6/68/Pampus_argenteus_100969499.jpg', 2048, 1533, '납작하고 은빛을 띠는 병어 한 마리', 'Navaneeth Sini George', 'https://commons.wikimedia.org/wiki/File:Pampus_argenteus_100969499.jpg', 'CC BY 4.0', 0.5, 0.52),
    (14, 0, 'PRIMARY', 'https://upload.wikimedia.org/wikipedia/commons/a/a9/Pike_conger.jpg', 4032, 2230, '수족관에서 긴 몸을 뻗고 있는 갯장어', 'Tambe', 'https://commons.wikimedia.org/wiki/File:Pike_conger.jpg', 'CC BY-SA 4.0', 0.5, 0.5),
    (15, 0, 'PRIMARY', 'https://upload.wikimedia.org/wikipedia/commons/d/d8/Conger_myriaster.jpg', 1000, 1000, '바위 사이에 몸을 굽힌 붕장어', 'Daiju Azuma (OpenCage)', 'https://commons.wikimedia.org/wiki/File:Conger_myriaster.jpg', 'CC BY-SA 2.5', 0.5, 0.52),
    (16, 0, 'PRIMARY', 'https://upload.wikimedia.org/wikipedia/commons/6/6c/Liza_haematocheila_by_OpenCage.jpg', 2001, 1287, '수조에서 옆모습으로 헤엄치는 가숭어', 'OpenCage', 'https://commons.wikimedia.org/wiki/File:Liza_haematocheila_by_OpenCage.jpg', 'CC BY-SA 2.5', 0.5, 0.5),
    (17, 0, 'PRIMARY', 'https://upload.wikimedia.org/wikipedia/commons/2/24/Scomber_japonicus_San_Diego.jpg', 3721, 2377, '잡았다가 방류한 고등어의 옆모습', 'Ruff tuff cream puff', 'https://commons.wikimedia.org/wiki/File:Scomber_japonicus_San_Diego.jpg', 'CC0 1.0', 0.5, 0.48),
    (18, 0, 'PRIMARY', 'https://www.nifs.go.kr/cmmn/images/MF00043931_watermark.jpg', 3072, 2304, '흰 배경에 길게 놓인 은빛 갈치 한 마리', '국립수산과학원', 'https://www.nifs.go.kr/contents/actionContentsCons0088.do', '공공누리 제1유형(출처표시)', 0.5, 0.5),
    (19, 0, 'PRIMARY', 'https://upload.wikimedia.org/wikipedia/commons/e/ed/Flathead-mullet-Aquarium-Of-The-Pacific.png', 6000, 4000, '수조에서 헤엄치는 숭어', 'Coughdrop12', 'https://commons.wikimedia.org/wiki/File:Flathead-mullet-Aquarium-Of-The-Pacific.png', 'CC BY-SA 4.0', 0.5, 0.48),
    (20, 0, 'PRIMARY', 'https://upload.wikimedia.org/wikipedia/commons/9/97/Flatfish_%2814670301310%29.jpg', 3035, 2043, '수산시장에 놓인 여러 마리의 가자미류', 'halfrain', 'https://commons.wikimedia.org/wiki/File:Flatfish_(14670301310).jpg', 'CC BY-SA 2.0', 0.5, 0.5),
    (21, 0, 'PRIMARY', 'https://upload.wikimedia.org/wikipedia/commons/c/c5/Epinephelus_akaara-2_by_OpenCage.jpg', 2736, 2736, '수조 속 붉은 반점 무늬의 붉바리', 'OpenCage / Daiju Azuma', 'https://commons.wikimedia.org/wiki/File:Epinephelus_akaara-2_by_OpenCage.jpg', 'CC BY-SA 2.5', 0.5, 0.5),
    (22, 0, 'PRIMARY', 'https://upload.wikimedia.org/wikipedia/commons/d/da/Epinephelus_septemfasciatus_Enosui1.jpg', 4032, 1822, '수조에서 헤엄치는 줄무늬 능성어', 'Totti', 'https://commons.wikimedia.org/wiki/File:Epinephelus_septemfasciatus_Enosui1.jpg', 'CC BY-SA 4.0', 0.5, 0.48),
    (23, 0, 'PRIMARY', 'https://upload.wikimedia.org/wikipedia/commons/a/a4/Epinephelus_bruneus_AQUAS.jpg', 4032, 3024, '수조 속 갈색 무늬 자바리의 옆모습', 'Totti', 'https://commons.wikimedia.org/wiki/File:Epinephelus_bruneus_AQUAS.jpg', 'CC BY-SA 4.0', 0.5, 0.5),
    (24, 0, 'PRIMARY', 'https://upload.wikimedia.org/wikipedia/commons/1/1d/Haliotis_discus_hannai_01.JPG', 7500, 5216, '검은 배경에 놓인 참전복 껍데기의 여러 방향 모습', 'H. Zell', 'https://commons.wikimedia.org/wiki/File:Haliotis_discus_hannai_01.JPG', 'CC BY-SA 3.0', 0.5, 0.5),
    (25, 0, 'PRIMARY', 'https://upload.wikimedia.org/wikipedia/commons/1/18/Silver_Trevally_%28Pseudocaranx_dentex%29.jpg', 4938, 3209, '수조에서 헤엄치는 은빛 시마아지의 옆모습', 'Bernard DUPONT', 'https://commons.wikimedia.org/wiki/File:Silver_Trevally_(Pseudocaranx_dentex).jpg', 'CC BY-SA 2.0', 0.5, 0.5),
    (26, 0, 'PRIMARY', 'https://upload.wikimedia.org/wikipedia/commons/8/85/KoshoDI.jpg', 640, 480, '수조 속 어름돔의 옆모습', 'Izuzuki', 'https://commons.wikimedia.org/wiki/File:KoshoDI.jpg', 'CC BY-SA 3.0', 0.5, 0.5),
    (27, 0, 'PRIMARY', 'https://upload.wikimedia.org/wikipedia/commons/d/dd/Sciaenops_ocellatus_%28FDA_212%29.jpg', 1280, 960, '흰 배경에 놓인 점성어 표본의 옆모습', 'J. Deeds / U.S. Food and Drug Administration', 'https://commons.wikimedia.org/wiki/File:Sciaenops_ocellatus_(FDA_212).jpg', 'Public domain — U.S. Government Work', 0.5, 0.5);

UPDATE fish
SET image_url = image.url
FROM fish_image image
WHERE image.fish_id = fish.id
  AND image.role = 'PRIMARY'
  AND fish.id IN (1, 2, 3, 4, 5, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27);

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
SELECT seed.fish_id,
       seed.claim_type,
       seed.publisher,
       seed.title,
       seed.url,
       NULL,
       TIMESTAMPTZ '2026-07-23 00:00:00+09',
       seed.license,
       seed.confidence
FROM (VALUES
    (1, 'PHOTO', 'Wikimedia Commons', '광어 대표 사진 원문', 'https://commons.wikimedia.org/wiki/File:Paralichthys_olivaceus_Umigatari.jpg', 'CC BY-SA 4.0', 'HIGH'),
    (2, 'PHOTO', 'Wikimedia Commons', '방어 대표 사진 원문', 'https://commons.wikimedia.org/wiki/File:Japanese_amberjack_by_Vincent_C_Chen.jpg', 'CC BY-SA 4.0', 'HIGH'),
    (3, 'PHOTO', 'Wikimedia Commons', '우럭 대표 사진 원문', 'https://commons.wikimedia.org/wiki/File:Sebastes_schlegelii_Muroran.jpg', 'CC BY-SA 4.0', 'HIGH'),
    (4, 'PHOTO', 'Wikimedia Commons', '참돔 대표 사진 원문', 'https://commons.wikimedia.org/wiki/File:Pagrus_major_ioworld.jpg', 'CC0 1.0', 'HIGH'),
    (5, 'PHOTO', 'Wikimedia Commons', '연어 대표 사진 원문', 'https://commons.wikimedia.org/wiki/File:Salmo_salar_221451741_(cropped).jpg', 'CC BY 4.0', 'HIGH'),
    (7, 'PHOTO', '국립수산과학원', '민어 대표 사진 원문', 'https://www.nifs.go.kr/contents/actionContentsCons0088.do', '공공누리 제1유형(출처표시)', 'HIGH'),
    (8, 'PHOTO', 'Wikimedia Commons', '농어 대표 사진 원문', 'https://commons.wikimedia.org/wiki/File:Lateolabrax_japonicus_Iwaki.jpg', 'CC BY-SA 4.0', 'HIGH'),
    (9, 'PHOTO', 'Wikimedia Commons', '전어 대표 사진 원문', 'https://commons.wikimedia.org/wiki/File:Konosirus_punctatus.JPG', 'CC BY-SA 4.0', 'HIGH'),
    (10, 'PHOTO', 'Wikimedia Commons', '도다리 대표 사진 원문', 'https://commons.wikimedia.org/wiki/File:Pleuronichthys_cornutus_at_Osaka_aquarium.jpg', 'CC BY-SA 4.0', 'HIGH'),
    (11, 'PHOTO', 'Wikimedia Commons', '감성돔 대표 사진 원문', 'https://commons.wikimedia.org/wiki/File:Acanthopagrus_schlegelii.JPG', 'CC BY-SA 3.0', 'HIGH'),
    (12, 'PHOTO', 'Wikimedia Commons', '돌돔 대표 사진 원문', 'https://commons.wikimedia.org/wiki/File:Striped_beakfish_Oplegnathus_fasciatus.jpg', 'CC BY-SA 3.0', 'HIGH'),
    (13, 'PHOTO', 'Wikimedia Commons', '병어 대표 사진 원문', 'https://commons.wikimedia.org/wiki/File:Pampus_argenteus_100969499.jpg', 'CC BY 4.0', 'HIGH'),
    (14, 'PHOTO', 'Wikimedia Commons', '갯장어 대표 사진 원문', 'https://commons.wikimedia.org/wiki/File:Pike_conger.jpg', 'CC BY-SA 4.0', 'HIGH'),
    (15, 'PHOTO', 'Wikimedia Commons', '붕장어 대표 사진 원문', 'https://commons.wikimedia.org/wiki/File:Conger_myriaster.jpg', 'CC BY-SA 2.5', 'HIGH'),
    (16, 'PHOTO', 'Wikimedia Commons', '가숭어 대표 사진 원문', 'https://commons.wikimedia.org/wiki/File:Liza_haematocheila_by_OpenCage.jpg', 'CC BY-SA 2.5', 'HIGH'),
    (17, 'PHOTO', 'Wikimedia Commons', '고등어 대표 사진 원문', 'https://commons.wikimedia.org/wiki/File:Scomber_japonicus_San_Diego.jpg', 'CC0 1.0', 'HIGH'),
    (18, 'PHOTO', '국립수산과학원', '갈치 대표 사진 원문', 'https://www.nifs.go.kr/contents/actionContentsCons0088.do', '공공누리 제1유형(출처표시)', 'HIGH'),
    (19, 'PHOTO', 'Wikimedia Commons', '숭어 대표 사진 원문', 'https://commons.wikimedia.org/wiki/File:Flathead-mullet-Aquarium-Of-The-Pacific.png', 'CC BY-SA 4.0', 'HIGH'),
    (20, 'PHOTO', 'Wikimedia Commons', '가자미 대표 사진 원문', 'https://commons.wikimedia.org/wiki/File:Flatfish_(14670301310).jpg', 'CC BY-SA 2.0', 'HIGH'),
    (21, 'PHOTO', 'Wikimedia Commons', '붉바리 대표 사진 원문', 'https://commons.wikimedia.org/wiki/File:Epinephelus_akaara-2_by_OpenCage.jpg', 'CC BY-SA 2.5', 'HIGH'),
    (22, 'PHOTO', 'Wikimedia Commons', '능성어 대표 사진 원문', 'https://commons.wikimedia.org/wiki/File:Epinephelus_septemfasciatus_Enosui1.jpg', 'CC BY-SA 4.0', 'HIGH'),
    (23, 'PHOTO', 'Wikimedia Commons', '자바리 대표 사진 원문', 'https://commons.wikimedia.org/wiki/File:Epinephelus_bruneus_AQUAS.jpg', 'CC BY-SA 4.0', 'HIGH'),
    (24, 'PHOTO', 'Wikimedia Commons', '전복 대표 사진 원문', 'https://commons.wikimedia.org/wiki/File:Haliotis_discus_hannai_01.JPG', 'CC BY-SA 3.0', 'HIGH'),
    (25, 'PHOTO', 'Wikimedia Commons', '시마아지 대표 사진 원문', 'https://commons.wikimedia.org/wiki/File:Silver_Trevally_(Pseudocaranx_dentex).jpg', 'CC BY-SA 2.0', 'HIGH'),
    (26, 'PHOTO', 'Wikimedia Commons', '어름돔 대표 사진 원문', 'https://commons.wikimedia.org/wiki/File:KoshoDI.jpg', 'CC BY-SA 3.0', 'HIGH'),
    (27, 'PHOTO', 'Wikimedia Commons', '점성어 대표 사진 원문', 'https://commons.wikimedia.org/wiki/File:Sciaenops_ocellatus_(FDA_212).jpg', 'Public domain — U.S. Government Work', 'HIGH')
) AS seed(fish_id, claim_type, publisher, title, url, license, confidence)
ON CONFLICT (fish_id, claim_type, url) DO UPDATE SET
    publisher = EXCLUDED.publisher,
    title = EXCLUDED.title,
    verified_at = EXCLUDED.verified_at,
    license = EXCLUDED.license,
    confidence = EXCLUDED.confidence;

DO $$
BEGIN
    IF (
        SELECT count(*)
        FROM fish_image
        WHERE fish_id IN (1, 2, 3, 4, 5, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27)
          AND role = 'PRIMARY'
          AND image_order = 0
          AND width > 0
          AND height > 0
          AND btrim(alt) <> ''
          AND btrim(credit) <> ''
          AND source_url IS NOT NULL
          AND btrim(license) <> ''
          AND focal_x BETWEEN 0 AND 1
          AND focal_y BETWEEN 0 AND 1
    ) <> 26 THEN
        RAISE EXCEPTION 'V13 fish image seed verification failed: ready media metadata incomplete';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM fish expected
        LEFT JOIN fish_image image
          ON image.fish_id = expected.id AND image.role = 'PRIMARY'
        WHERE expected.id IN (1, 2, 3, 4, 5, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27)
          AND (image.id IS NULL OR expected.image_url IS DISTINCT FROM image.url)
    ) THEN
        RAISE EXCEPTION 'V13 fish image seed verification failed: primary/image_url mismatch';
    END IF;

    -- No catalog entries are blocked in this reviewed manifest.

    IF (
        SELECT count(DISTINCT source.fish_id)
        FROM fish_source source
        WHERE source.fish_id IN (1, 2, 3, 4, 5, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27)
          AND source.claim_type = 'PHOTO'
          AND source.confidence = 'HIGH'
    ) <> 26 THEN
        RAISE EXCEPTION 'V13 photo source verification failed';
    END IF;
END
$$;
