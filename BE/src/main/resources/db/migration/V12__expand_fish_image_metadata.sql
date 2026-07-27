-- D3 responsive image/licensing metadata expand migration.
-- Existing URL rows remain usable through the legacy images/image_url response fields.

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM fish_image WHERE image_order < 0) THEN
        RAISE EXCEPTION 'V12 fish_image preflight failed: image_order must be non-negative';
    END IF;
    IF EXISTS (SELECT 1 FROM fish_image WHERE url IS NULL OR btrim(url) = '') THEN
        RAISE EXCEPTION 'V12 fish_image preflight failed: legacy URL must not be blank';
    END IF;
    IF EXISTS (
        SELECT 1
        FROM fish_image
        GROUP BY fish_id, image_order
        HAVING count(*) > 1
    ) THEN
        RAISE EXCEPTION 'V12 fish_image preflight failed: duplicate fish/order rows';
    END IF;
END
$$;

CREATE SEQUENCE fish_image_id_seq;

ALTER TABLE fish_image
    ADD COLUMN id BIGINT,
    ADD COLUMN role VARCHAR(20),
    ADD COLUMN public_id VARCHAR(255),
    ADD COLUMN width INTEGER,
    ADD COLUMN height INTEGER,
    ADD COLUMN alt VARCHAR(300),
    ADD COLUMN credit VARCHAR(300),
    ADD COLUMN source_url TEXT,
    ADD COLUMN license VARCHAR(150),
    ADD COLUMN focal_x NUMERIC(5, 4),
    ADD COLUMN focal_y NUMERIC(5, 4),
    ADD COLUMN blur_data_url TEXT,
    ADD COLUMN created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

ALTER TABLE fish_image
    ALTER COLUMN id SET DEFAULT nextval('fish_image_id_seq');
ALTER SEQUENCE fish_image_id_seq OWNED BY fish_image.id;

UPDATE fish_image
SET id = nextval('fish_image_id_seq'),
    role = CASE WHEN image_order = 0 THEN 'PRIMARY' ELSE 'GALLERY' END
WHERE id IS NULL;

UPDATE fish_image
SET alt = fish.name || ' 사진'
FROM fish
WHERE fish.id = fish_image.fish_id
  AND fish_image.alt IS NULL;

ALTER TABLE fish_image
    ALTER COLUMN id SET NOT NULL,
    ALTER COLUMN role SET NOT NULL,
    ALTER COLUMN alt SET NOT NULL;

ALTER TABLE fish_image DROP CONSTRAINT fish_image_pkey;
ALTER TABLE fish_image ADD CONSTRAINT fish_image_pkey PRIMARY KEY (id);
ALTER TABLE fish_image
    ADD CONSTRAINT uq_fish_image_order UNIQUE (fish_id, image_order);

ALTER TABLE fish_image
    ADD CONSTRAINT ck_fish_image_order CHECK (image_order >= 0),
    ADD CONSTRAINT ck_fish_image_role CHECK (role IN ('PRIMARY', 'GALLERY')),
    ADD CONSTRAINT ck_fish_image_url_not_blank CHECK (btrim(url) <> ''),
    ADD CONSTRAINT ck_fish_image_alt_not_blank CHECK (btrim(alt) <> ''),
    ADD CONSTRAINT ck_fish_image_dimensions CHECK (
        (width IS NULL AND height IS NULL)
        OR (width IS NOT NULL AND height IS NOT NULL AND width > 0 AND height > 0)
    ),
    ADD CONSTRAINT ck_fish_image_focal_point CHECK (
        (focal_x IS NULL AND focal_y IS NULL)
        OR (
            focal_x IS NOT NULL
            AND focal_y IS NOT NULL
            AND width IS NOT NULL
            AND height IS NOT NULL
            AND focal_x BETWEEN 0 AND 1
            AND focal_y BETWEEN 0 AND 1
        )
    ),
    ADD CONSTRAINT ck_fish_image_public_id_not_blank CHECK (
        public_id IS NULL OR btrim(public_id) <> ''
    ),
    ADD CONSTRAINT ck_fish_image_source_url_http CHECK (
        source_url IS NULL OR source_url ~ '^https?://[^[:space:]]+$'
    ),
    ADD CONSTRAINT ck_fish_image_attribution CHECK (
        (credit IS NULL AND source_url IS NULL AND license IS NULL)
        OR (
            credit IS NOT NULL
            AND btrim(credit) <> ''
            AND source_url IS NOT NULL
            AND license IS NOT NULL
            AND btrim(license) <> ''
        )
    ),
    ADD CONSTRAINT ck_fish_image_blur_data_url CHECK (
        blur_data_url IS NULL OR blur_data_url LIKE 'data:image/%;base64,%'
    );

CREATE UNIQUE INDEX uq_fish_image_public_id
    ON fish_image(public_id)
    WHERE public_id IS NOT NULL;

CREATE UNIQUE INDEX uq_fish_image_primary
    ON fish_image(fish_id)
    WHERE role = 'PRIMARY';

CREATE INDEX idx_fish_image_fish_role_order
    ON fish_image(fish_id, role, image_order);

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM fish_image WHERE id IS NULL OR role IS NULL OR alt IS NULL) THEN
        RAISE EXCEPTION 'V12 fish_image backfill verification failed';
    END IF;
    IF (SELECT count(*) FROM fish_image) <> (SELECT count(DISTINCT id) FROM fish_image) THEN
        RAISE EXCEPTION 'V12 fish_image surrogate ID verification failed';
    END IF;
END
$$;
