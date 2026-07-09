-- 도감 정리: '도미'는 참돔과 중복이라 제거.
-- id 6이 실제 '도미'일 때만 동작하는 가드 — 나중에 새 생선이 id 6을 받아도 지워지지 않는다.
DELETE FROM fish_season_month WHERE fish_id IN (SELECT id FROM fish WHERE id = 6 AND name = '도미');
DELETE FROM fish_taste_tag    WHERE fish_id IN (SELECT id FROM fish WHERE id = 6 AND name = '도미');
DELETE FROM fish_tip          WHERE fish_id IN (SELECT id FROM fish WHERE id = 6 AND name = '도미');
DELETE FROM fish_image        WHERE fish_id IN (SELECT id FROM fish WHERE id = 6 AND name = '도미');
DELETE FROM fish_similar      WHERE fish_id IN (SELECT id FROM fish WHERE id = 6 AND name = '도미')
                                 OR similar_fish_id IN (SELECT id FROM fish WHERE id = 6 AND name = '도미');
DELETE FROM review            WHERE fish_id IN (SELECT id FROM fish WHERE id = 6 AND name = '도미');
DELETE FROM fish WHERE id = 6 AND name = '도미';

INSERT INTO fish (id, name, name_en, image_url, taste_desc, price_level, featured, description, created_at)
VALUES
    (1, '광어', 'Olive flounder', '/fish/gwangeo.jpg', '담백하고 쫄깃한 식감. 회 입문자에게 무난합니다.', 2, true, '담백하고 쫄깃한 국민 흰살회', now()),
    (2, '방어', 'Yellowtail', '/fish/bangeo.jpg', '기름기가 풍부하고 고소해 겨울에 특히 인기가 많습니다.', 3, true, '겨울에 기름 오른 진한 풍미의 생선', now()),
    (3, '우럭', 'Rockfish', NULL, '탄탄한 살과 깔끔한 단맛이 있어 회와 매운탕 모두 잘 어울립니다.', 2, false, '쫄깃한 식감과 시원한 국물 맛', now()),
    (4, '참돔', 'Red seabream', '/fish/chamdom.jpg', '은은한 단맛과 고급스러운 감칠맛이 특징입니다.', 3, true, '잔칫상에 잘 어울리는 고급 흰살생선', now()),
    (5, '연어', 'Salmon', '/fish/yeoneo.jpg', '부드럽고 기름진 식감으로 초밥과 샐러드에 잘 맞습니다.', 2, false, '부드럽고 고소한 인기 생선', now())
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    name_en = EXCLUDED.name_en,
    image_url = EXCLUDED.image_url,
    taste_desc = EXCLUDED.taste_desc,
    price_level = EXCLUDED.price_level,
    featured = EXCLUDED.featured,
    description = EXCLUDED.description;

INSERT INTO fish_season_month (fish_id, month) VALUES
    (1, 11), (1, 12), (1, 1), (1, 2),
    (2, 11), (2, 12), (2, 1), (2, 2),
    (3, 4), (3, 5), (3, 6),
    (4, 3), (4, 4), (4, 5),
    (5, 9), (5, 10), (5, 11)
ON CONFLICT DO NOTHING;

INSERT INTO fish_taste_tag (fish_id, tag) VALUES
    (1, '담백'), (1, '쫄깃'),
    (2, '고소'), (2, '기름진'),
    (3, '담백'), (3, '쫄깃'), (3, '감칠맛'),
    (4, '담백'), (4, '단맛'), (4, '고급'),
    (5, '고소'), (5, '부드러운')
ON CONFLICT DO NOTHING;

DELETE FROM fish_image WHERE fish_id IN (1, 2, 3, 4, 5);

INSERT INTO fish_image (fish_id, image_order, url) VALUES
    (1, 0, '/fish/gwangeo.jpg'),
    (2, 0, '/fish/bangeo.jpg'),
    (4, 0, '/fish/chamdom.jpg'),
    (5, 0, '/fish/yeoneo.jpg')
ON CONFLICT (fish_id, image_order) DO UPDATE SET
    url = EXCLUDED.url;

INSERT INTO fish_similar (fish_id, similar_fish_id) VALUES
    (1, 3), (1, 4),
    (2, 5),
    (3, 1),
    (4, 1), (4, 3),
    (5, 2)
ON CONFLICT DO NOTHING;

INSERT INTO fish_tip (fish_id, tip_order, content) VALUES
    (1, 0, '초고추장보다 간장+고추냉이로 담백함을 살려보세요'),
    (1, 1, '지느러미살은 쫄깃함이 좋아 따로 맛보면 좋아요'),
    (2, 0, '뱃살은 살짝 차갑게 먹으면 고소함이 살아나요'),
    (2, 1, '김이나 묵은지와 곁들이면 기름진 맛이 산뜻해져요'),
    (3, 0, '회로 먹고 남은 뼈는 매운탕으로 끓이면 좋아요'),
    (3, 1, '된장과 마늘을 곁들인 쌈으로도 잘 어울려요'),
    (4, 0, '껍질을 살짝 데친 유비키로 풍미를 살려보세요'),
    (4, 1, '하루 정도 숙성하면 단맛이 더 또렷해져요'),
    (5, 0, '양파와 케이퍼를 곁들이면 느끼함이 줄어요'),
    (5, 1, '덮밥이나 포케로 변주하기 좋습니다')
ON CONFLICT (fish_id, tip_order) DO UPDATE SET
    content = EXCLUDED.content;

SELECT setval('fish_id_seq', (SELECT MAX(id) FROM fish));
