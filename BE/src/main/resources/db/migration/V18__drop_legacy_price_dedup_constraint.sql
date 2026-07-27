-- B3 Release C (contract): apply only after V16/V17 and one stable application release.
-- Use SPRING_FLYWAY_TARGET=17 during the stabilization window, then remove that target to apply V18.

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM shop_price_observation WHERE dedup_hash IS NULL) THEN
        RAISE EXCEPTION 'cannot retire legacy price dedup path while dedup_hash contains NULL';
    END IF;
    IF NOT EXISTS (
        SELECT 1
        FROM pg_indexes
        WHERE schemaname = current_schema()
          AND indexname = 'uq_shop_price_observation_dedup_hash'
    ) THEN
        RAISE EXCEPTION 'cannot retire legacy price dedup path before hash unique index exists';
    END IF;
END
$$;

-- A btree uniqueness constraint containing raw_text rejects genuinely long source text.
-- The V15 compatibility trigger keeps rollback binaries able to write after this contract step.
ALTER TABLE shop_price_observation
    DROP CONSTRAINT IF EXISTS uq_shop_price_observation;
