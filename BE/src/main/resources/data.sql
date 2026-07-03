INSERT INTO fish (id, name, name_en, image_url, taste_desc, price_level, featured, description, created_at)
VALUES
    (1, '광어', 'Olive flounder', 'https://images.unsplash.com/photo-1615141982883-c7ad0e69fd62?auto=format&fit=crop&w=900&q=80', '담백하고 쫄깃한 식감. 회 입문자에게 무난합니다.', 2, true, '담백하고 쫄깃한 국민 흰살회', now()),
    (2, '방어', 'Yellowtail', 'https://images.unsplash.com/photo-1534766555764-ce878a5e3a2b?auto=format&fit=crop&w=900&q=80', '기름기가 풍부하고 고소해 겨울에 특히 인기가 많습니다.', 3, true, '겨울에 기름 오른 진한 풍미의 생선', now()),
    (3, '우럭', 'Rockfish', 'https://images.unsplash.com/photo-1510130387422-82bed34b37e9?auto=format&fit=crop&w=900&q=80', '탄탄한 살과 깔끔한 단맛이 있어 회와 매운탕 모두 잘 어울립니다.', 2, false, '쫄깃한 식감과 시원한 국물 맛', now()),
    (4, '참돔', 'Red seabream', 'https://images.unsplash.com/photo-1524704796725-9fc3044a58b2?auto=format&fit=crop&w=900&q=80', '은은한 단맛과 고급스러운 감칠맛이 특징입니다.', 3, true, '잔칫상에 잘 어울리는 고급 흰살생선', now()),
    (5, '연어', 'Salmon', 'https://images.unsplash.com/photo-1485921325833-c519f76c4927?auto=format&fit=crop&w=900&q=80', '부드럽고 기름진 식감으로 초밥과 샐러드에 잘 맞습니다.', 2, false, '부드럽고 고소한 인기 생선', now()),
    (6, '도미', 'Sea bream', 'https://images.unsplash.com/photo-1501595091296-3aa970afb3ff?auto=format&fit=crop&w=900&q=80', '깔끔한 감칠맛과 단단한 살결로 숙성회에 잘 어울립니다.', 3, false, '담백하고 우아한 감칠맛의 흰살생선', now())
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
    (5, 9), (5, 10), (5, 11),
    (6, 3), (6, 4), (6, 5), (6, 6)
ON CONFLICT DO NOTHING;

INSERT INTO fish_taste_tag (fish_id, tag) VALUES
    (1, '담백'), (1, '쫄깃'),
    (2, '고소'), (2, '기름진'),
    (3, '담백'), (3, '쫄깃'), (3, '감칠맛'),
    (4, '담백'), (4, '단맛'), (4, '고급'),
    (5, '고소'), (5, '부드러운'),
    (6, '담백'), (6, '감칠맛'), (6, '쫄깃')
ON CONFLICT DO NOTHING;

INSERT INTO fish_image (fish_id, image_order, url) VALUES
    (1, 0, 'https://images.unsplash.com/photo-1615141982883-c7ad0e69fd62?auto=format&fit=crop&w=900&q=80'),
    (1, 1, 'https://images.unsplash.com/photo-1559847844-5315695dadae?auto=format&fit=crop&w=900&q=80'),
    (1, 2, 'https://images.unsplash.com/photo-1553621042-f6e147245754?auto=format&fit=crop&w=900&q=80'),
    (2, 0, 'https://images.unsplash.com/photo-1534766555764-ce878a5e3a2b?auto=format&fit=crop&w=900&q=80'),
    (2, 1, 'https://images.unsplash.com/photo-1579871494447-9811cf80d66c?auto=format&fit=crop&w=900&q=80'),
    (2, 2, 'https://images.unsplash.com/photo-1617196034796-73dfa7b1fd56?auto=format&fit=crop&w=900&q=80'),
    (3, 0, 'https://images.unsplash.com/photo-1510130387422-82bed34b37e9?auto=format&fit=crop&w=900&q=80'),
    (3, 1, 'https://images.unsplash.com/photo-1544943910-4c1dc44aab44?auto=format&fit=crop&w=900&q=80'),
    (3, 2, 'https://images.unsplash.com/photo-1615141982883-c7ad0e69fd62?auto=format&fit=crop&w=900&q=80'),
    (4, 0, 'https://images.unsplash.com/photo-1524704796725-9fc3044a58b2?auto=format&fit=crop&w=900&q=80'),
    (4, 1, 'https://images.unsplash.com/photo-1607301405390-d831c242f59b?auto=format&fit=crop&w=900&q=80'),
    (4, 2, 'https://images.unsplash.com/photo-1579584425555-c3ce17fd4351?auto=format&fit=crop&w=900&q=80'),
    (5, 0, 'https://images.unsplash.com/photo-1485921325833-c519f76c4927?auto=format&fit=crop&w=900&q=80'),
    (5, 1, 'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?auto=format&fit=crop&w=900&q=80'),
    (5, 2, 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=900&q=80'),
    (6, 0, 'https://images.unsplash.com/photo-1501595091296-3aa970afb3ff?auto=format&fit=crop&w=900&q=80'),
    (6, 1, 'https://images.unsplash.com/photo-1544943910-4c1dc44aab44?auto=format&fit=crop&w=900&q=80')
ON CONFLICT (fish_id, image_order) DO UPDATE SET
    url = EXCLUDED.url;

INSERT INTO fish_similar (fish_id, similar_fish_id) VALUES
    (1, 3), (1, 6),
    (2, 5),
    (3, 1), (3, 6),
    (4, 6), (4, 1),
    (5, 2),
    (6, 1), (6, 4)
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
    (5, 1, '덮밥이나 포케로 변주하기 좋습니다'),
    (6, 0, '맑은 지리탕으로 끓이면 국물이 시원해요'),
    (6, 1, '소금구이로도 담백하게 즐길 수 있어요')
ON CONFLICT (fish_id, tip_order) DO UPDATE SET
    content = EXCLUDED.content;

INSERT INTO review (id, fish_id, nickname, rating, content, image_url, password_hash, helpful_count, created_at)
VALUES
    (1, 1, '회러버', 5, '쫄깃하고 담백해서 처음 먹는 사람에게도 추천해요.', NULL, '$2a$10$7EqJtq98hPqEX7fNZaFWoOhi48WK8khVMqZBqNkYR6zCQXEr1fYZS', 4, now()),
    (2, 1, '바다사랑', 4, '기본기가 좋은 흰살회라 실패가 적습니다.', NULL, '$2a$10$7EqJtq98hPqEX7fNZaFWoOhi48WK8khVMqZBqNkYR6zCQXEr1fYZS', 2, now()),
    (3, 1, '초장파', 2, '식감은 좋았지만 제 입맛에는 조금 심심했어요.', NULL, '$2a$10$7EqJtq98hPqEX7fNZaFWoOhi48WK8khVMqZBqNkYR6zCQXEr1fYZS', 1, now()),
    (4, 2, '겨울방어왕', 5, '기름진 맛이 진해서 겨울에 꼭 먹게 됩니다.', NULL, '$2a$10$7EqJtq98hPqEX7fNZaFWoOhi48WK8khVMqZBqNkYR6zCQXEr1fYZS', 7, now()),
    (5, 2, '묵은지한입', 4, '묵은지랑 먹으니 느끼함이 잡혀서 좋았습니다.', NULL, '$2a$10$7EqJtq98hPqEX7fNZaFWoOhi48WK8khVMqZBqNkYR6zCQXEr1fYZS', 5, now()),
    (6, 2, '담백취향', 3, '맛은 진한데 기름기가 많아서 호불호가 있을 듯해요.', NULL, '$2a$10$7EqJtq98hPqEX7fNZaFWoOhi48WK8khVMqZBqNkYR6zCQXEr1fYZS', 0, now()),
    (7, 3, '매운탕러버', 5, '회도 좋고 남은 뼈로 끓인 매운탕이 특히 좋았어요.', NULL, '$2a$10$7EqJtq98hPqEX7fNZaFWoOhi48WK8khVMqZBqNkYR6zCQXEr1fYZS', 6, now()),
    (8, 3, '쌈장파', 3, '쫄깃하지만 향이 살짝 강하게 느껴졌습니다.', NULL, '$2a$10$7EqJtq98hPqEX7fNZaFWoOhi48WK8khVMqZBqNkYR6zCQXEr1fYZS', 2, now()),
    (9, 4, '돔좋아', 5, '숙성해서 먹으니 단맛이 확실히 살아났어요.', NULL, '$2a$10$7EqJtq98hPqEX7fNZaFWoOhi48WK8khVMqZBqNkYR6zCQXEr1fYZS', 4, now()),
    (10, 4, '가성비체크', 2, '맛은 좋지만 가격이 높아서 자주 먹기는 어렵네요.', NULL, '$2a$10$7EqJtq98hPqEX7fNZaFWoOhi48WK8khVMqZBqNkYR6zCQXEr1fYZS', 1, now()),
    (11, 5, '연어덮밥', 4, '부드럽고 고소해서 덮밥으로 먹기 좋았습니다.', NULL, '$2a$10$7EqJtq98hPqEX7fNZaFWoOhi48WK8khVMqZBqNkYR6zCQXEr1fYZS', 3, now()),
    (12, 5, '훈제보다생', 1, '기름진 맛이 제 취향은 아니었어요.', NULL, '$2a$10$7EqJtq98hPqEX7fNZaFWoOhi48WK8khVMqZBqNkYR6zCQXEr1fYZS', 0, now()),
    (13, 6, '지리탕파', 4, '지리탕으로 먹었을 때 국물이 깔끔했습니다.', NULL, '$2a$10$7EqJtq98hPqEX7fNZaFWoOhi48WK8khVMqZBqNkYR6zCQXEr1fYZS', 2, now()),
    (14, 6, '숙성회입문', 3, '깔끔하지만 참돔보다 인상은 약했습니다.', NULL, '$2a$10$7EqJtq98hPqEX7fNZaFWoOhi48WK8khVMqZBqNkYR6zCQXEr1fYZS', 1, now())
ON CONFLICT (id) DO UPDATE SET
    fish_id = EXCLUDED.fish_id,
    nickname = EXCLUDED.nickname,
    rating = EXCLUDED.rating,
    content = EXCLUDED.content,
    image_url = EXCLUDED.image_url,
    password_hash = EXCLUDED.password_hash,
    helpful_count = EXCLUDED.helpful_count;

SELECT setval('fish_id_seq', (SELECT MAX(id) FROM fish));
SELECT setval('review_id_seq', (SELECT MAX(id) FROM review));
