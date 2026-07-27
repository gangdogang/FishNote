import copy
import json
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from render_fish_image_seed import render
from validate_fish_image_manifest import validate_manifest


MANIFEST_PATH = Path(__file__).resolve().parents[1] / "config" / "fish_image_manifest.json"
MIGRATION_PATH = (
    Path(__file__).resolve().parents[1]
    / "BE"
    / "src"
    / "main"
    / "resources"
    / "db"
    / "migration"
    / "V13__seed_verified_fish_images.sql"
)


class FishImageManifestTest(unittest.TestCase):
    def setUp(self):
        self.manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))

    def test_curated_manifest_is_valid(self):
        self.assertEqual([], validate_manifest(self.manifest))

    def test_committed_seed_migration_matches_the_reviewed_manifest(self):
        self.assertEqual(
            MIGRATION_PATH.read_text(encoding="utf-8"),
            render(self.manifest),
        )

    def test_duplicate_identity_fails_closed(self):
        broken = copy.deepcopy(self.manifest)
        broken["items"][1]["fishId"] = broken["items"][0]["fishId"]
        self.assertTrue(any("duplicate fishId" in error for error in validate_manifest(broken)))

    def test_noncommercial_or_unsafe_media_is_rejected(self):
        broken = copy.deepcopy(self.manifest)
        broken["items"][0]["license"] = "CC BY-NC 4.0"
        broken["items"][0]["url"] = "javascript:alert(1)"
        errors = validate_manifest(broken)
        self.assertTrue(any("license" in error for error in errors))
        self.assertTrue(any("absolute credential-free HTTPS" in error for error in errors))

    def test_blocked_item_cannot_hide_an_unreviewed_url(self):
        broken = copy.deepcopy(self.manifest)
        blocked = broken["items"][0]
        blocked["status"] = "BLOCKED"
        blocked["reason"] = "identity review pending"
        blocked["placeholderAlt"] = f"{blocked['name']} 사진 준비 중"
        for field in (
            "role", "imageOrder", "url", "sourceUrl", "credit", "license",
            "width", "height", "alt", "focalPoint", "commercialUseConfirmed",
        ):
            blocked.pop(field, None)
        broken["coverage"] = {
            "ready": self.manifest["coverage"]["ready"] - 1,
            "blocked": self.manifest["coverage"]["blocked"] + 1,
        }
        blocked["url"] = "https://upload.wikimedia.org/fake.jpg"
        self.assertTrue(any("must not carry" in error for error in validate_manifest(broken)))

    def test_invalid_review_date_is_rejected_before_sql_rendering(self):
        broken = copy.deepcopy(self.manifest)
        broken["reviewedAt"] = "2026-07-99"
        self.assertTrue(any("reviewedAt" in error for error in validate_manifest(broken)))


if __name__ == "__main__":
    unittest.main()
