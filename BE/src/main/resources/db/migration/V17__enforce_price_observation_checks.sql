-- B3/T1: fail closed before enforcing price invariants used by every read projection.

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM shop_price_observation
        WHERE price_min_krw <= 0
           OR price_max_krw <= 0
           OR price_min_krw > price_max_krw
           OR confidence < 0
           OR confidence > 1
    ) THEN
        RAISE EXCEPTION 'invalid legacy shop price rows must be repaired before V17';
    END IF;
END
$$;

ALTER TABLE shop_price_observation
    DROP CONSTRAINT IF EXISTS ck_shop_price_observation_positive;
ALTER TABLE shop_price_observation
    ADD CONSTRAINT ck_shop_price_observation_positive
        CHECK (price_min_krw > 0 AND price_max_krw > 0) NOT VALID;

ALTER TABLE shop_price_observation
    DROP CONSTRAINT IF EXISTS ck_shop_price_observation_range;
ALTER TABLE shop_price_observation
    ADD CONSTRAINT ck_shop_price_observation_range
        CHECK (price_min_krw <= price_max_krw) NOT VALID;

ALTER TABLE shop_price_observation
    DROP CONSTRAINT IF EXISTS ck_shop_price_observation_confidence;
ALTER TABLE shop_price_observation
    ADD CONSTRAINT ck_shop_price_observation_confidence
        CHECK (confidence BETWEEN 0 AND 1) NOT VALID;

ALTER TABLE shop_price_observation
    VALIDATE CONSTRAINT ck_shop_price_observation_positive;
ALTER TABLE shop_price_observation
    VALIDATE CONSTRAINT ck_shop_price_observation_range;
ALTER TABLE shop_price_observation
    VALIDATE CONSTRAINT ck_shop_price_observation_confidence;
