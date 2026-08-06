-- 로그인 회원의 비공개 시식 기록. 공개 후기와 분리해 개인 메모·장소를 노출하지 않는다.
CREATE TABLE tasting_entry (
    id           BIGSERIAL PRIMARY KEY,
    user_id      BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    fish_id      BIGINT NOT NULL REFERENCES fish(id) ON DELETE CASCADE,
    tasted_on    DATE NOT NULL,
    rating       SMALLINT CHECK (rating BETWEEN 1 AND 5),
    preparation  VARCHAR(20) NOT NULL,
    place_name   VARCHAR(100),
    note         VARCHAR(500),
    image_url    TEXT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ,
    CONSTRAINT ck_tasting_entry_preparation
        CHECK (preparation IN ('RAW', 'AGED', 'SEKKOSI', 'OTHER'))
);

CREATE INDEX idx_tasting_entry_user_date
    ON tasting_entry(user_id, tasted_on DESC, id DESC);
CREATE INDEX idx_tasting_entry_fish
    ON tasting_entry(fish_id);

-- 기존 업로드 자산 수명주기를 시식 기록 사진에도 재사용한다.
ALTER TABLE review_image_asset
    ADD COLUMN tasting_entry_id BIGINT REFERENCES tasting_entry(id) ON DELETE SET NULL;
ALTER TABLE review_image_asset
    ADD CONSTRAINT uq_review_image_asset_tasting_entry UNIQUE (tasting_entry_id);
