-- 후기 업로드 자산은 도감 사진(fish_image)과 수명주기·소유권이 다르므로 별도 추적한다.
CREATE TABLE review_image_asset (
    id                  UUID PRIMARY KEY,
    public_id           VARCHAR(255) NOT NULL UNIQUE,
    secure_url          TEXT,
    uploader_key        VARCHAR(67) NOT NULL,
    status              VARCHAR(20) NOT NULL,
    expires_at          TIMESTAMPTZ NOT NULL,
    upload_completed_at TIMESTAMPTZ,
    attached_at         TIMESTAMPTZ,
    review_id           BIGINT UNIQUE REFERENCES review(id) ON DELETE SET NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT ck_review_image_asset_status CHECK (
        status IN ('UPLOADING', 'PENDING', 'ATTACHED', 'DELETE_PENDING')
    ),
    CONSTRAINT ck_review_image_asset_state CHECK (
        (status = 'UPLOADING' AND secure_url IS NULL AND review_id IS NULL
            AND upload_completed_at IS NULL AND attached_at IS NULL)
        OR (status = 'PENDING' AND secure_url IS NOT NULL AND review_id IS NULL
            AND upload_completed_at IS NOT NULL AND attached_at IS NULL)
        OR (status = 'ATTACHED' AND secure_url IS NOT NULL AND attached_at IS NOT NULL)
        OR (status = 'DELETE_PENDING' AND review_id IS NULL)
    )
);

CREATE UNIQUE INDEX uq_review_image_asset_secure_url
    ON review_image_asset(secure_url)
    WHERE secure_url IS NOT NULL;

CREATE INDEX idx_review_image_asset_cleanup
    ON review_image_asset(status, expires_at, id)
    WHERE status IN ('UPLOADING', 'PENDING', 'DELETE_PENDING')
       OR (status = 'ATTACHED' AND review_id IS NULL);
