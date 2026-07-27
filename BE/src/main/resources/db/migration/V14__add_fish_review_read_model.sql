-- B1: cursor read paths and an additive review aggregate read model.

CREATE TABLE IF NOT EXISTS fish_review_stat (
    fish_id        BIGINT PRIMARY KEY REFERENCES fish(id) ON DELETE CASCADE,
    review_count   BIGINT NOT NULL DEFAULT 0,
    rating_count   BIGINT NOT NULL DEFAULT 0,
    rating_sum     BIGINT NOT NULL DEFAULT 0,
    rating_1_count BIGINT NOT NULL DEFAULT 0,
    rating_2_count BIGINT NOT NULL DEFAULT 0,
    rating_3_count BIGINT NOT NULL DEFAULT 0,
    rating_4_count BIGINT NOT NULL DEFAULT 0,
    rating_5_count BIGINT NOT NULL DEFAULT 0,
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT ck_fish_review_stat_counts CHECK (
        review_count >= 0
        AND rating_count >= 0
        AND rating_count <= review_count
        AND rating_sum >= 0
        AND rating_1_count >= 0
        AND rating_2_count >= 0
        AND rating_3_count >= 0
        AND rating_4_count >= 0
        AND rating_5_count >= 0
        AND rating_count = rating_1_count + rating_2_count + rating_3_count
                           + rating_4_count + rating_5_count
        AND rating_sum = rating_1_count + rating_2_count * 2 + rating_3_count * 3
                         + rating_4_count * 4 + rating_5_count * 5
    )
);

INSERT INTO fish_review_stat (
    fish_id,
    review_count,
    rating_count,
    rating_sum,
    rating_1_count,
    rating_2_count,
    rating_3_count,
    rating_4_count,
    rating_5_count,
    updated_at
)
SELECT
    f.id,
    count(r.id),
    count(r.rating),
    coalesce(sum(r.rating), 0),
    count(*) FILTER (WHERE r.rating = 1),
    count(*) FILTER (WHERE r.rating = 2),
    count(*) FILTER (WHERE r.rating = 3),
    count(*) FILTER (WHERE r.rating = 4),
    count(*) FILTER (WHERE r.rating = 5),
    now()
FROM fish f
LEFT JOIN review r ON r.fish_id = f.id
GROUP BY f.id
ON CONFLICT (fish_id) DO UPDATE SET
    review_count = EXCLUDED.review_count,
    rating_count = EXCLUDED.rating_count,
    rating_sum = EXCLUDED.rating_sum,
    rating_1_count = EXCLUDED.rating_1_count,
    rating_2_count = EXCLUDED.rating_2_count,
    rating_3_count = EXCLUDED.rating_3_count,
    rating_4_count = EXCLUDED.rating_4_count,
    rating_5_count = EXCLUDED.rating_5_count,
    updated_at = EXCLUDED.updated_at;

CREATE OR REPLACE FUNCTION apply_fish_review_stat_delta(
    target_fish_id BIGINT,
    review_delta BIGINT,
    target_rating SMALLINT,
    rating_delta BIGINT
) RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
    UPDATE fish_review_stat SET
        review_count = fish_review_stat.review_count + review_delta,
        rating_count = fish_review_stat.rating_count
                       + CASE WHEN target_rating IS NULL THEN 0 ELSE rating_delta END,
        rating_sum = fish_review_stat.rating_sum
                     + CASE WHEN target_rating IS NULL THEN 0 ELSE target_rating * rating_delta END,
        rating_1_count = fish_review_stat.rating_1_count
                         + CASE WHEN target_rating = 1 THEN rating_delta ELSE 0 END,
        rating_2_count = fish_review_stat.rating_2_count
                         + CASE WHEN target_rating = 2 THEN rating_delta ELSE 0 END,
        rating_3_count = fish_review_stat.rating_3_count
                         + CASE WHEN target_rating = 3 THEN rating_delta ELSE 0 END,
        rating_4_count = fish_review_stat.rating_4_count
                         + CASE WHEN target_rating = 4 THEN rating_delta ELSE 0 END,
        rating_5_count = fish_review_stat.rating_5_count
                         + CASE WHEN target_rating = 5 THEN rating_delta ELSE 0 END,
        updated_at = now()
    WHERE fish_id = target_fish_id;

    IF FOUND THEN
        RETURN;
    END IF;

    IF review_delta < 0 THEN
        RAISE EXCEPTION 'fish_review_stat row is missing for fish %', target_fish_id;
    END IF;

    INSERT INTO fish_review_stat (
        fish_id,
        review_count,
        rating_count,
        rating_sum,
        rating_1_count,
        rating_2_count,
        rating_3_count,
        rating_4_count,
        rating_5_count,
        updated_at
    ) VALUES (
        target_fish_id,
        review_delta,
        CASE WHEN target_rating IS NULL THEN 0 ELSE rating_delta END,
        CASE WHEN target_rating IS NULL THEN 0 ELSE target_rating * rating_delta END,
        CASE WHEN target_rating = 1 THEN rating_delta ELSE 0 END,
        CASE WHEN target_rating = 2 THEN rating_delta ELSE 0 END,
        CASE WHEN target_rating = 3 THEN rating_delta ELSE 0 END,
        CASE WHEN target_rating = 4 THEN rating_delta ELSE 0 END,
        CASE WHEN target_rating = 5 THEN rating_delta ELSE 0 END,
        now()
    )
    ON CONFLICT (fish_id) DO UPDATE SET
        review_count = fish_review_stat.review_count + EXCLUDED.review_count,
        rating_count = fish_review_stat.rating_count + EXCLUDED.rating_count,
        rating_sum = fish_review_stat.rating_sum + EXCLUDED.rating_sum,
        rating_1_count = fish_review_stat.rating_1_count + EXCLUDED.rating_1_count,
        rating_2_count = fish_review_stat.rating_2_count + EXCLUDED.rating_2_count,
        rating_3_count = fish_review_stat.rating_3_count + EXCLUDED.rating_3_count,
        rating_4_count = fish_review_stat.rating_4_count + EXCLUDED.rating_4_count,
        rating_5_count = fish_review_stat.rating_5_count + EXCLUDED.rating_5_count,
        updated_at = now();
END;
$$;

CREATE OR REPLACE FUNCTION maintain_fish_review_stat()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        PERFORM apply_fish_review_stat_delta(NEW.fish_id, 1, NEW.rating, 1);
        RETURN NEW;
    END IF;

    IF TG_OP = 'DELETE' THEN
        PERFORM apply_fish_review_stat_delta(OLD.fish_id, -1, OLD.rating, -1);
        RETURN OLD;
    END IF;

    IF OLD.fish_id IS DISTINCT FROM NEW.fish_id OR OLD.rating IS DISTINCT FROM NEW.rating THEN
        PERFORM apply_fish_review_stat_delta(OLD.fish_id, -1, OLD.rating, -1);
        PERFORM apply_fish_review_stat_delta(NEW.fish_id, 1, NEW.rating, 1);
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_review_maintain_fish_review_stat ON review;
CREATE TRIGGER trg_review_maintain_fish_review_stat
AFTER INSERT OR DELETE OR UPDATE OF fish_id, rating ON review
FOR EACH ROW EXECUTE FUNCTION maintain_fish_review_stat();

CREATE INDEX IF NOT EXISTS idx_review_fish_created_id
    ON review(fish_id, created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_review_fish_helpful_created_id
    ON review(fish_id, helpful_count DESC, created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_fish_name_id
    ON fish(name ASC, id ASC);

CREATE INDEX IF NOT EXISTS idx_fish_review_stat_popular
    ON fish_review_stat(review_count DESC, rating_count DESC, rating_sum DESC, fish_id ASC);
