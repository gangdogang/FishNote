-- B3 Release A (expand): nullable hash plus a rolling-release compatibility trigger.
-- Deploy the dual-writing application and verify parity before applying V16.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE shop_price_observation
    ADD COLUMN IF NOT EXISTS dedup_hash VARCHAR(64);

-- Rolling-release compatibility: an older application does not know the new column. Populate the
-- exact same v1 key in PostgreSQL whenever a legacy writer omits it, so rollback remains possible
-- after NOT NULL enforcement and the raw-text btree contract can be retired safely.
CREATE OR REPLACE FUNCTION set_shop_price_observation_dedup_hash()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    observed_epoch_millis BIGINT;
    dedup_key TEXT;
BEGIN
    observed_epoch_millis := floor(extract(epoch FROM NEW.observed_at) * 1000)::BIGINT;
    dedup_key := 'v1'
        || '|' || octet_length(convert_to(observed_epoch_millis::TEXT, 'UTF8'))
                 || ':' || observed_epoch_millis::TEXT
        || '|' || octet_length(convert_to(btrim(NEW.source_type), 'UTF8'))
                 || ':' || btrim(NEW.source_type)
        || '|' || octet_length(convert_to(btrim(coalesce(NEW.source_name, '')), 'UTF8'))
                 || ':' || btrim(coalesce(NEW.source_name, ''))
        || '|' || octet_length(convert_to(NEW.price_min_krw::TEXT, 'UTF8'))
                 || ':' || NEW.price_min_krw::TEXT
        || '|' || octet_length(convert_to(NEW.price_max_krw::TEXT, 'UTF8'))
                 || ':' || NEW.price_max_krw::TEXT
        || '|' || octet_length(convert_to(NEW.raw_text, 'UTF8'))
                 || ':' || NEW.raw_text;
    NEW.dedup_hash := encode(digest(convert_to(dedup_key, 'UTF8'), 'sha256'), 'hex');
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_shop_price_observation_dedup_hash
    ON shop_price_observation;
CREATE TRIGGER trg_shop_price_observation_dedup_hash
BEFORE INSERT OR UPDATE OF observed_at, source_type, source_name,
    price_min_krw, price_max_krw, raw_text, dedup_hash
ON shop_price_observation
FOR EACH ROW
EXECUTE FUNCTION set_shop_price_observation_dedup_hash();

COMMENT ON COLUMN shop_price_observation.dedup_hash IS
    'Nullable SHA-256 v1 identity during expand; application and compatibility trigger dual-write it';
