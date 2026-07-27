-- Cloudinary delete는 DB transaction 밖에서 실행하므로 claim token으로 worker를 fencing한다.
ALTER TABLE review_image_asset
    ADD COLUMN deletion_claim_id UUID,
    ADD COLUMN cleanup_available_at TIMESTAMPTZ,
    ADD COLUMN cleanup_attempts INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN cleanup_origin_status VARCHAR(20),
    ADD COLUMN cleanup_not_found_safe_at TIMESTAMPTZ;

UPDATE review_image_asset
SET cleanup_available_at = updated_at,
    cleanup_origin_status = 'UPLOADING',
    cleanup_not_found_safe_at = now() + INTERVAL '24 hours'
WHERE status = 'DELETE_PENDING';

ALTER TABLE review_image_asset
    DROP CONSTRAINT ck_review_image_asset_state;

ALTER TABLE review_image_asset
    ADD CONSTRAINT ck_review_image_asset_state CHECK (
        (status = 'UPLOADING' AND secure_url IS NULL AND review_id IS NULL
            AND upload_completed_at IS NULL AND attached_at IS NULL
            AND deletion_claim_id IS NULL AND cleanup_available_at IS NULL
            AND cleanup_attempts = 0 AND cleanup_origin_status IS NULL
            AND cleanup_not_found_safe_at IS NULL)
        OR (status = 'PENDING' AND secure_url IS NOT NULL AND review_id IS NULL
            AND upload_completed_at IS NOT NULL AND attached_at IS NULL
            AND deletion_claim_id IS NULL AND cleanup_available_at IS NULL
            AND cleanup_attempts = 0 AND cleanup_origin_status IS NULL
            AND cleanup_not_found_safe_at IS NULL)
        OR (status = 'ATTACHED' AND secure_url IS NOT NULL AND attached_at IS NOT NULL
            AND deletion_claim_id IS NULL AND cleanup_available_at IS NULL
            AND cleanup_attempts = 0 AND cleanup_origin_status IS NULL
            AND cleanup_not_found_safe_at IS NULL)
        OR (status = 'DELETE_PENDING' AND review_id IS NULL
            AND deletion_claim_id IS NULL AND cleanup_available_at IS NULL
            AND cleanup_attempts = 0 AND cleanup_origin_status IS NULL
            AND cleanup_not_found_safe_at IS NULL)
        OR (status = 'DELETE_PENDING' AND review_id IS NULL
            AND deletion_claim_id IS NULL AND cleanup_available_at IS NOT NULL
            AND cleanup_attempts >= 0
            AND cleanup_origin_status IN ('UPLOADING', 'PENDING', 'ATTACHED', 'DELETE_PENDING')
            AND ((cleanup_origin_status = 'UPLOADING' AND cleanup_not_found_safe_at IS NOT NULL)
                OR (cleanup_origin_status <> 'UPLOADING' AND cleanup_not_found_safe_at IS NULL)))
        OR (status = 'DELETE_PENDING' AND review_id IS NULL
            AND deletion_claim_id IS NOT NULL AND cleanup_available_at IS NOT NULL
            AND cleanup_attempts >= 1
            AND cleanup_origin_status IN ('UPLOADING', 'PENDING', 'ATTACHED', 'DELETE_PENDING')
            AND ((cleanup_origin_status = 'UPLOADING' AND cleanup_not_found_safe_at IS NOT NULL)
                OR (cleanup_origin_status <> 'UPLOADING' AND cleanup_not_found_safe_at IS NULL)))
    );

DROP INDEX idx_review_image_asset_cleanup;

CREATE INDEX idx_review_image_asset_cleanup
    ON review_image_asset(cleanup_available_at, id)
    WHERE status = 'DELETE_PENDING' AND deletion_claim_id IS NULL;

CREATE INDEX idx_review_image_asset_expiry
    ON review_image_asset(expires_at, id)
    WHERE status IN ('UPLOADING', 'PENDING');

CREATE INDEX idx_review_image_asset_claimed
    ON review_image_asset(updated_at, id)
    WHERE status = 'DELETE_PENDING' AND deletion_claim_id IS NOT NULL;

CREATE INDEX idx_review_image_asset_orphan
    ON review_image_asset(id)
    WHERE status = 'ATTACHED' AND review_id IS NULL;
