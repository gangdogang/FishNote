-- B3 Release B (backfill/enforce): audit duplicate legacy rows, then make the hash authoritative.
-- The legacy raw-text unique constraint remains until the separately deployable V18 contract step.

CREATE TABLE IF NOT EXISTS shop_price_observation_duplicate_audit (
    audit_id       BIGSERIAL PRIMARY KEY,
    audited_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    kept_id        BIGINT NOT NULL,
    duplicate_id   BIGINT NOT NULL,
    dedup_hash     VARCHAR(64) NOT NULL,
    row_snapshot   JSONB NOT NULL,
    CONSTRAINT uq_shop_price_duplicate_audit UNIQUE (duplicate_id)
);

-- Keep this expression byte-for-byte compatible with DedupKeyFactory and the V15 trigger.
WITH canonical AS (
    SELECT id,
           'v1'
           || '|' || octet_length(convert_to((floor(extract(epoch FROM observed_at) * 1000)::BIGINT)::TEXT, 'UTF8'))
                    || ':' || (floor(extract(epoch FROM observed_at) * 1000)::BIGINT)::TEXT
           || '|' || octet_length(convert_to(btrim(source_type), 'UTF8'))
                    || ':' || btrim(source_type)
           || '|' || octet_length(convert_to(btrim(coalesce(source_name, '')), 'UTF8'))
                    || ':' || btrim(coalesce(source_name, ''))
           || '|' || octet_length(convert_to(price_min_krw::TEXT, 'UTF8'))
                    || ':' || price_min_krw::TEXT
           || '|' || octet_length(convert_to(price_max_krw::TEXT, 'UTF8'))
                    || ':' || price_max_krw::TEXT
           || '|' || octet_length(convert_to(raw_text, 'UTF8'))
                    || ':' || raw_text AS dedup_key
    FROM shop_price_observation
    WHERE dedup_hash IS NULL
)
UPDATE shop_price_observation observation
SET dedup_hash = encode(digest(convert_to(canonical.dedup_key, 'UTF8'), 'sha256'), 'hex')
FROM canonical
WHERE observation.id = canonical.id;

WITH ranked AS (
    SELECT id,
           dedup_hash,
           first_value(id) OVER (PARTITION BY dedup_hash ORDER BY id) AS kept_id,
           row_number() OVER (PARTITION BY dedup_hash ORDER BY id) AS duplicate_rank
    FROM shop_price_observation
)
INSERT INTO shop_price_observation_duplicate_audit (
    kept_id,
    duplicate_id,
    dedup_hash,
    row_snapshot
)
SELECT ranked.kept_id,
       ranked.id,
       ranked.dedup_hash,
       to_jsonb(observation)
FROM ranked
JOIN shop_price_observation observation ON observation.id = ranked.id
WHERE ranked.duplicate_rank > 1
ON CONFLICT (duplicate_id) DO NOTHING;

DELETE FROM shop_price_observation observation
USING shop_price_observation_duplicate_audit audit
WHERE observation.id = audit.duplicate_id;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM shop_price_observation WHERE dedup_hash IS NULL) THEN
        RAISE EXCEPTION 'shop_price_observation.dedup_hash backfill left NULL rows';
    END IF;
    IF EXISTS (
        SELECT dedup_hash
        FROM shop_price_observation
        GROUP BY dedup_hash
        HAVING count(*) > 1
    ) THEN
        RAISE EXCEPTION 'shop_price_observation.dedup_hash backfill left duplicate rows';
    END IF;
END
$$;

ALTER TABLE shop_price_observation
    ALTER COLUMN dedup_hash SET NOT NULL;

ALTER TABLE shop_price_observation
    DROP CONSTRAINT IF EXISTS ck_shop_price_dedup_hash_format;
ALTER TABLE shop_price_observation
    ADD CONSTRAINT ck_shop_price_dedup_hash_format
        CHECK (dedup_hash ~ '^[0-9a-f]{64}$');

CREATE UNIQUE INDEX IF NOT EXISTS uq_shop_price_observation_dedup_hash
    ON shop_price_observation (dedup_hash);

COMMENT ON COLUMN shop_price_observation.dedup_hash IS
    'SHA-256 v1 identity written by DedupKeyFactory or the rolling compatibility trigger';
