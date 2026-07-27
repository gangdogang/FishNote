#!/usr/bin/env python3
"""Render the reviewed image manifest into the deterministic V13 Flyway migration."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from validate_fish_image_manifest import validate_manifest


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_MANIFEST = ROOT / "config" / "fish_image_manifest.json"
DEFAULT_MIGRATION = ROOT / "BE" / "src" / "main" / "resources" / "db" / "migration" / "V13__seed_verified_fish_images.sql"


def sql_text(value: object) -> str:
    if value is None:
        return "NULL"
    return "'" + str(value).replace("'", "''") + "'"


def values_block(rows: list[tuple[object, ...]], indent: str = "    ") -> str:
    return ",\n".join(
        indent + "(" + ", ".join(sql_text(value) if not isinstance(value, (int, float)) else str(value) for value in row) + ")"
        for row in rows
    )


def render(manifest: dict) -> str:
    errors = validate_manifest(manifest)
    if errors:
        raise ValueError("invalid manifest:\n" + "\n".join(errors))

    items = sorted(manifest["items"], key=lambda item: item["fishId"])
    ready = [item for item in items if item["status"] == "READY"]
    blocked = [item for item in items if item["status"] == "BLOCKED"]
    all_ids = ", ".join(str(item["fishId"]) for item in items)
    ready_ids = ", ".join(str(item["fishId"]) for item in ready)
    blocked_ids = ", ".join(str(item["fishId"]) for item in blocked)
    blocked_verification = f"""    IF EXISTS (
        SELECT 1
        FROM fish
        LEFT JOIN fish_image image
          ON image.fish_id = fish.id AND image.role = 'PRIMARY'
        WHERE fish.id IN ({blocked_ids})
          AND (fish.image_url IS NOT NULL OR image.id IS NOT NULL)
    ) THEN
        RAISE EXCEPTION 'V13 blocked catalog entry received unverified media';
    END IF;""" if blocked else "    -- No catalog entries are blocked in this reviewed manifest."

    identity_rows = [
        (item["fishId"], item["name"], item["slug"])
        for item in items
    ]
    scientific_rows = [
        (item["fishId"], item["name"], item["scientificName"])
        for item in items
        if item.get("scientificName")
    ]
    image_rows = [
        (
            item["fishId"],
            0,
            "PRIMARY",
            item["url"],
            item["width"],
            item["height"],
            item["alt"],
            item["credit"],
            item["sourceUrl"],
            item["license"],
            item["focalPoint"]["x"],
            item["focalPoint"]["y"],
        )
        for item in ready
    ]
    source_rows = [
        (
            item["fishId"],
            "PHOTO",
            "국립수산과학원" if "nifs.go.kr" in item["sourceUrl"] else "Wikimedia Commons",
            f"{item['name']} 대표 사진 원문",
            item["sourceUrl"],
            item["license"],
            "HIGH",
        )
        for item in ready
    ]

    return f"""-- Generated from config/fish_image_manifest.json by scripts/render_fish_image_seed.py.
-- Do not hand-edit media rows. Update the reviewed manifest and regenerate this migration.
-- Coverage at review time: {len(ready)} verified primary photos, {len(blocked)} intentionally blocked.

DO $$
BEGIN
    IF (
        SELECT count(*)
        FROM (VALUES
{values_block(identity_rows, '            ')}
        ) AS expected(id, name, slug)
        JOIN fish ON fish.id = expected.id
            AND fish.name = expected.name
            AND fish.slug = expected.slug
    ) <> {len(items)} THEN
        RAISE EXCEPTION 'V13 fish image seed preflight failed: catalog identity drift';
    END IF;
END
$$;

UPDATE fish
SET scientific_name = mapping.scientific_name
FROM (VALUES
{values_block(scientific_rows)}
) AS mapping(id, expected_name, scientific_name)
WHERE fish.id = mapping.id
  AND fish.name = mapping.expected_name;

-- A primary catalog image is publishable only when it exists in the reviewed manifest.
DELETE FROM fish_image
WHERE fish_id IN ({all_ids})
  AND (role = 'PRIMARY' OR image_order = 0);

UPDATE fish
SET image_url = NULL
WHERE id IN ({all_ids});

INSERT INTO fish_image (
    fish_id,
    image_order,
    role,
    url,
    width,
    height,
    alt,
    credit,
    source_url,
    license,
    focal_x,
    focal_y
)
VALUES
{values_block(image_rows)};

UPDATE fish
SET image_url = image.url
FROM fish_image image
WHERE image.fish_id = fish.id
  AND image.role = 'PRIMARY'
  AND fish.id IN ({ready_ids});

INSERT INTO fish_source (
    fish_id,
    claim_type,
    publisher,
    title,
    url,
    published_at,
    verified_at,
    license,
    confidence
)
SELECT seed.fish_id,
       seed.claim_type,
       seed.publisher,
       seed.title,
       seed.url,
       NULL,
       TIMESTAMPTZ '{manifest['reviewedAt']} 00:00:00+09',
       seed.license,
       seed.confidence
FROM (VALUES
{values_block(source_rows)}
) AS seed(fish_id, claim_type, publisher, title, url, license, confidence)
ON CONFLICT (fish_id, claim_type, url) DO UPDATE SET
    publisher = EXCLUDED.publisher,
    title = EXCLUDED.title,
    verified_at = EXCLUDED.verified_at,
    license = EXCLUDED.license,
    confidence = EXCLUDED.confidence;

DO $$
BEGIN
    IF (
        SELECT count(*)
        FROM fish_image
        WHERE fish_id IN ({ready_ids})
          AND role = 'PRIMARY'
          AND image_order = 0
          AND width > 0
          AND height > 0
          AND btrim(alt) <> ''
          AND btrim(credit) <> ''
          AND source_url IS NOT NULL
          AND btrim(license) <> ''
          AND focal_x BETWEEN 0 AND 1
          AND focal_y BETWEEN 0 AND 1
    ) <> {len(ready)} THEN
        RAISE EXCEPTION 'V13 fish image seed verification failed: ready media metadata incomplete';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM fish expected
        LEFT JOIN fish_image image
          ON image.fish_id = expected.id AND image.role = 'PRIMARY'
        WHERE expected.id IN ({ready_ids})
          AND (image.id IS NULL OR expected.image_url IS DISTINCT FROM image.url)
    ) THEN
        RAISE EXCEPTION 'V13 fish image seed verification failed: primary/image_url mismatch';
    END IF;

{blocked_verification}

    IF (
        SELECT count(DISTINCT source.fish_id)
        FROM fish_source source
        WHERE source.fish_id IN ({ready_ids})
          AND source.claim_type = 'PHOTO'
          AND source.confidence = 'HIGH'
    ) <> {len(ready)} THEN
        RAISE EXCEPTION 'V13 photo source verification failed';
    END IF;
END
$$;
"""


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--manifest", type=Path, default=DEFAULT_MANIFEST)
    parser.add_argument("--check", type=Path)
    args = parser.parse_args()

    manifest = json.loads(args.manifest.read_text(encoding="utf-8"))
    try:
        rendered = render(manifest)
    except ValueError as exc:
        print(exc, file=sys.stderr)
        return 1

    if args.check:
        actual = args.check.read_text(encoding="utf-8")
        if actual != rendered:
            print(f"generated migration is stale: {args.check}", file=sys.stderr)
            return 1
        print(f"generated migration matches manifest: {args.check}")
        return 0

    sys.stdout.write(rendered)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
