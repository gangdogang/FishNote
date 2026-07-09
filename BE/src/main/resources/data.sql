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

-- 1차 출처 검증 반영 (docs/11, 2026-07-10):
-- ① 연어(id 5) → 연중 (국내 유통 대부분 노르웨이산 양식 — 제철 개념 미적용)
-- ② 기존 '숭어'(id 16)는 가숭어(겨울)와 숭어(봄) 두 종을 혼동한 값 → 가숭어로 교정, 숭어(보리숭어)는 id 19로 분리
-- 제철 월·맛 태그는 UPSERT로 지워지지 않으므로 대상 어종만 비우고 아래 INSERT로 재구성한다.
DELETE FROM fish_season_month WHERE fish_id IN (5, 16);
DELETE FROM fish_taste_tag WHERE fish_id = 16;

INSERT INTO fish (id, name, name_en, image_url, taste_desc, price_level, featured, description, created_at)
VALUES
    (1, '광어', 'Olive flounder', '/fish/gwangeo.jpg', '담백하고 쫄깃한 식감. 회 입문자에게 무난합니다.', 2, true, '담백하고 쫄깃한 국민 흰살회', now()),
    (2, '방어', 'Yellowtail', '/fish/bangeo.jpg', '기름기가 풍부하고 고소해 겨울에 특히 인기가 많습니다.', 3, true, '겨울에 기름 오른 진한 풍미의 생선', now()),
    (3, '우럭', 'Rockfish', NULL, '탄탄한 살과 깔끔한 단맛이 있어 회와 매운탕 모두 잘 어울립니다.', 2, false, '쫄깃한 식감과 시원한 국물 맛', now()),
    (4, '참돔', 'Red seabream', '/fish/chamdom.jpg', '은은한 단맛과 고급스러운 감칠맛이 특징입니다.', 3, true, '잔칫상에 잘 어울리는 고급 흰살생선', now()),
    (5, '연어', 'Salmon', '/fish/yeoneo.jpg', '부드럽고 기름진 식감. 국내 유통 연어는 대부분 노르웨이산 양식이라 연중 맛이 고릅니다.', 2, false, '부드럽고 고소한, 연중 즐기는 인기 생선', now())
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
    (5, 1), (5, 2), (5, 3), (5, 4), (5, 5), (5, 6),
    (5, 7), (5, 8), (5, 9), (5, 10), (5, 11), (5, 12)
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

-- ============================================================
-- 종 확충 (7~18): 12종 추가 — 총 17종
-- ⚠️ 제철·맛 정보는 통용 상식 기준으로 작성됨. 출처 검증 전 상태이며
--    BACKLOG.md P1-1(데이터 출처 확보)에서 전수 교차검증·교정 예정.
-- ============================================================

INSERT INTO fish (id, name, name_en, image_url, taste_desc, price_level, featured, description, created_at)
VALUES
    (7, '민어', 'Brown croaker', NULL, '살이 부드럽고 담백하며 씹을수록 은은한 단맛이 올라옵니다.', 3, false, '복날에 찾는 여름 보양 횟감', now()),
    (8, '농어', 'Japanese seabass', NULL, '여름에 살이 올라 산뜻하고 담백한 맛이 좋습니다.', 2, false, '여름 흰살회의 산뜻한 기준', now()),
    (9, '전어', 'Gizzard shad', NULL, '가을에 기름이 올라 고소함이 절정에 달합니다.', 1, false, '가을이면 생각나는 고소한 국민 생선', now()),
    (10, '도다리', NULL, NULL, '봄에 살이 오르는 가자미류로 담백하고 개운합니다.', 2, false, '봄 하면 도다리, 쑥국으로도 유명', now()),
    (11, '감성돔', 'Black seabream', NULL, '겨울에 살이 단단해지고 감칠맛이 깊어집니다.', 3, false, '겨울 낚시꾼들이 최고로 치는 돔', now()),
    (12, '돌돔', 'Striped beakfish', NULL, '단단하고 쫄깃한 식감에 고소한 뒷맛이 따라옵니다.', 3, false, '횟감의 황제로 불리는 고급 어종', now()),
    (13, '병어', 'Silver pomfret', NULL, '살이 곱고 부드러우며 고소한 맛이 은은합니다.', 2, false, '고소하고 부드러운 여름 별미', now()),
    (14, '갯장어', 'Daggertooth pike conger', NULL, '탄력 있는 살에 고소함이 진해 여름 샤브로도 즐깁니다.', 3, false, '여름 남해안의 별미, 하모', now()),
    (15, '붕장어', 'Whitespotted conger', NULL, '쫄깃하고 고소하며 기름기가 적당해 회로 인기가 많습니다.', 2, false, '아나고회로 친숙한 바닷장어', now()),
    (16, '가숭어', NULL, NULL, '겨울에 기름이 올라 고소하고 차진 맛. 횟집에서는 참숭어·밀치라는 이름으로 더 자주 만납니다.', 1, false, '겨울 횟집 가성비 대표, 참숭어', now()),
    (17, '고등어', 'Chub mackerel', NULL, '기름진 등푸른 생선으로 신선할 때 회 맛이 각별합니다.', 2, false, '산지에서만 맛보던 기름진 별미', now()),
    (18, '갈치', 'Largehead hairtail', NULL, '은빛 살이 부드럽고 기름져 제주에서 회로 즐깁니다.', 2, false, '제주 은갈치로 유명한 부드러운 맛', now()),
    (19, '숭어', 'Flathead grey mullet', NULL, '봄에 살이 차올라 담백하고 은은한 단맛이 납니다. 보리 익을 무렵 맛있다고 해서 보리숭어라고도 불러요.', 1, false, '봄이 제철인 보리숭어', now())
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    name_en = EXCLUDED.name_en,
    image_url = EXCLUDED.image_url,
    taste_desc = EXCLUDED.taste_desc,
    price_level = EXCLUDED.price_level,
    featured = EXCLUDED.featured,
    description = EXCLUDED.description;

INSERT INTO fish_season_month (fish_id, month) VALUES
    (7, 6), (7, 7), (7, 8),
    (8, 6), (8, 7), (8, 8),
    (9, 9), (9, 10), (9, 11),
    (10, 3), (10, 4), (10, 5),
    (11, 11), (11, 12), (11, 1), (11, 2),
    (12, 6), (12, 7), (12, 8),
    (13, 5), (13, 6), (13, 7), (13, 8),
    (14, 6), (14, 7), (14, 8),
    (15, 6), (15, 7), (15, 8),
    (16, 11), (16, 12), (16, 1), (16, 2),
    (17, 9), (17, 10), (17, 11), (17, 12),
    (18, 7), (18, 8), (18, 9), (18, 10),
    (19, 3), (19, 4), (19, 5), (19, 6)
ON CONFLICT DO NOTHING;

INSERT INTO fish_taste_tag (fish_id, tag) VALUES
    (7, '부드러운'), (7, '담백'), (7, '단맛'),
    (8, '담백'), (8, '감칠맛'),
    (9, '고소'), (9, '기름진'),
    (10, '담백'), (10, '부드러운'),
    (11, '감칠맛'), (11, '담백'), (11, '쫄깃'),
    (12, '쫄깃'), (12, '고소'), (12, '고급'),
    (13, '고소'), (13, '부드러운'),
    (14, '고소'), (14, '쫄깃'),
    (15, '고소'), (15, '쫄깃'),
    (16, '고소'), (16, '기름진'),
    (17, '기름진'), (17, '고소'),
    (18, '부드러운'), (18, '기름진'),
    (19, '담백'), (19, '단맛')
ON CONFLICT DO NOTHING;

INSERT INTO fish_similar (fish_id, similar_fish_id) VALUES
    (7, 8), (8, 7),
    (7, 4),
    (8, 3),
    (9, 17), (17, 9),
    (10, 1), (1, 10),
    (11, 4), (11, 12),
    (12, 11), (12, 4),
    (13, 7), (13, 9),
    (14, 15), (15, 14),
    (16, 19), (19, 16),
    (17, 18), (18, 17)
ON CONFLICT DO NOTHING;

INSERT INTO fish_tip (fish_id, tip_order, content) VALUES
    (7, 0, '배꼽살과 부레는 소금기름장에 — 민어에서만 맛보는 별미예요'),
    (7, 1, '살짝 두껍게 썰어야 부드러운 식감이 살아나요'),
    (8, 0, '얼음물에 잠깐 담갔다 건지면 살이 탱탱해져요'),
    (8, 1, '여름 농어는 기름장보다 간장+고추냉이가 잘 어울려요'),
    (9, 0, '뼈째 썰기(세꼬시)로 먹으면 고소함이 배가돼요'),
    (9, 1, '기름이 오르는 9월 말부터가 진짜 제철이에요'),
    (10, 0, '봄 도다리는 쑥국으로도 꼭 한번 드셔보세요'),
    (10, 1, '살이 얇은 편이라 얇게 떠서 여러 점 먹는 맛이에요'),
    (11, 0, '껍질을 살짝 데치면(유비키) 풍미가 살아나요'),
    (11, 1, '지방이 오른 겨울 뱃살부터 맛보세요'),
    (12, 0, '껍질째 구운 껍질도 별미로 챙겨 드세요'),
    (12, 1, '두께를 달리 썰어 식감 차이를 비교해보세요'),
    (13, 0, '뼈가 연해 뼈째 썰어 먹기도 해요'),
    (13, 1, '양념장 없이 담백하게 먼저 맛보세요'),
    (14, 0, '끓는 물에 살짝 데치는 샤브(유비키)가 대표 먹는 법이에요'),
    (14, 1, '여름 하모는 매실 소스와 궁합이 좋아요'),
    (15, 0, '잘게 썰어 기름장에 버무려 먹는 게 부산식이에요'),
    (15, 1, '씹을수록 고소함이 올라오니 천천히 즐기세요'),
    (16, 0, '노란 눈이 선명한 것이 좋은 횟감이라고 해요'),
    (16, 1, '가격이 착해 푸짐하게 즐기기 좋아요'),
    (17, 0, '고등어회는 신선도가 생명 — 산지 표기를 확인하세요'),
    (17, 1, '김에 밥과 함께 싸 먹으면 기름진 맛이 잘 어울려요'),
    (18, 0, '제주 은갈치회는 얇게 썰어 껍질째 먹어요'),
    (18, 1, '기름기가 있어 레몬이나 초생강과 잘 맞아요'),
    (19, 0, '겨울엔 가숭어, 봄엔 숭어 — 철따라 바꿔 즐겨보세요'),
    (19, 1, '봄 숭어는 담백해서 초장보다 기름장이 잘 어울려요')
ON CONFLICT (fish_id, tip_order) DO UPDATE SET
    content = EXCLUDED.content;

SELECT setval('fish_id_seq', (SELECT MAX(id) FROM fish));
