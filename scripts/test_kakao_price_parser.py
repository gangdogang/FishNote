#!/usr/bin/env python3

from __future__ import annotations

import csv
import json
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch


PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT / "scripts"))

import kakao_price_parser as parser  # noqa: E402


class KakaoPriceAliasTest(unittest.TestCase):
    def setUp(self) -> None:
        self.aliases = parser.sort_aliases(
            (
                ("광어", "광어"),
                ("제주광어", "광어"),
                ("연어", "연어"),
                ("점성어", "점성어"),
            )
        )

    def test_matches_shared_java_python_alias_parity_cases(self) -> None:
        fixture_path = PROJECT_ROOT / "BE/src/test/resources/price-parser-alias-parity.tsv"
        with fixture_path.open(newline="", encoding="utf-8") as handle:
            for case in csv.DictReader(handle, delimiter="\t"):
                with self.subTest(line=case["line"]):
                    canonical, reported = parser.extract_alias(case["line"], self.aliases)
                    self.assertEqual(case["canonical_fish_name"], canonical)
                    self.assertEqual(case["reported_name"], reported)

    def test_loads_only_a_versioned_db_derived_manifest(self) -> None:
        document = {
            "schemaVersion": 1,
            "source": "fish_alias",
            "items": [
                {"alias": "광어", "canonicalFishName": "광어"},
                {"alias": "제주광어", "canonicalFishName": "광어"},
                {"alias": "연어", "canonicalFishName": "연어"},
            ],
        }
        with tempfile.TemporaryDirectory() as directory:
            manifest_path = Path(directory) / "fish-alias-manifest.json"
            manifest_path.write_text(json.dumps(document), encoding="utf-8")

            aliases = parser.load_aliases(str(manifest_path))

        self.assertEqual(["제주광어", "광어", "연어"], list(aliases))
        self.assertEqual("광어", aliases["제주광어"])

    def test_loads_the_default_http_manifest_contract(self) -> None:
        document = {
            "schemaVersion": 1,
            "source": "fish_alias",
            "items": [{"alias": "도미", "canonicalFishName": "참돔"}],
        }
        with patch.object(parser, "urlopen") as mocked_urlopen:
            mocked_response = mocked_urlopen.return_value.__enter__.return_value
            mocked_response.read.return_value = json.dumps(document).encode("utf-8")

            aliases = parser.load_aliases("https://fishnote.example/api/v1/fish/aliases/price-parser")

        mocked_urlopen.assert_called_once_with(
            "https://fishnote.example/api/v1/fish/aliases/price-parser",
            timeout=10,
        )
        self.assertEqual({"도미": "참돔"}, aliases)

    def test_rejects_non_db_and_conflicting_manifests(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            manifest_path = Path(directory) / "fish-alias-manifest.json"
            manifest_path.write_text(
                json.dumps({"schemaVersion": 1, "source": "csv", "items": []}),
                encoding="utf-8",
            )
            with self.assertRaisesRegex(parser.AliasManifestError, "fish_alias"):
                parser.load_aliases(str(manifest_path))

            manifest_path.write_text(
                json.dumps(
                    {
                        "schemaVersion": 1,
                        "source": "fish_alias",
                        "items": [
                            {"alias": "점성어", "canonicalFishName": "점성어"},
                            {"alias": "점 성 어", "canonicalFishName": "민어"},
                        ],
                    }
                ),
                encoding="utf-8",
            )
            with self.assertRaisesRegex(parser.AliasManifestError, "more than one"):
                parser.load_aliases(str(manifest_path))


if __name__ == "__main__":
    unittest.main()
