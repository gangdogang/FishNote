#!/usr/bin/env python3
"""Fail closed when the curated fish image manifest loses identity or license metadata."""

from __future__ import annotations

import json
import sys
from datetime import date
from pathlib import Path
from urllib.parse import urlparse


EXPECTED = {
    1: ("광어", "gwangeo"),
    2: ("방어", "bangeo"),
    3: ("우럭", "ureok"),
    4: ("참돔", "chamdom"),
    5: ("연어", "yeoneo"),
    7: ("민어", "mineo"),
    8: ("농어", "nongeo"),
    9: ("전어", "jeoneo"),
    10: ("도다리", "dodari"),
    11: ("감성돔", "gamseongdom"),
    12: ("돌돔", "doldom"),
    13: ("병어", "byeongeo"),
    14: ("갯장어", "gaetjangeo"),
    15: ("붕장어", "bungjangeo"),
    16: ("가숭어", "gasungeo"),
    17: ("고등어", "godeungeo"),
    18: ("갈치", "galchi"),
    19: ("숭어", "sungeo"),
    20: ("가자미", "gajami"),
    21: ("붉바리", "bulgbari"),
    22: ("능성어", "neungseongeo"),
    23: ("자바리", "jabari"),
    24: ("전복", "jeonbok"),
    25: ("시마아지", "shimaaji"),
    26: ("어름돔", "eoreumdom"),
    27: ("점성어", "jeomseongeo"),
}

ALLOWED_LICENSES = {
    "CC0 1.0",
    "CC BY 4.0",
    "CC BY-SA 4.0",
    "CC BY-SA 3.0",
    "CC BY-SA 2.5",
    "CC BY-SA 2.0",
    "공공누리 제1유형(출처표시)",
    "Public domain — U.S. Government Work",
}

ALLOWED_IMAGE_HOSTS = {"upload.wikimedia.org", "www.nifs.go.kr"}
ALLOWED_SOURCE_HOSTS = {"commons.wikimedia.org", "www.nifs.go.kr"}
HOSTED_IMAGE_ORIGIN = "https://www.fishnote.kr"


def require_text(item: dict, field: str, errors: list[str]) -> str:
    value = item.get(field)
    if not isinstance(value, str) or not value.strip():
        errors.append(f"fish {item.get('fishId')}: {field} must be non-blank text")
        return ""
    return value.strip()


def require_https(value: str, hosts: set[str], label: str, fish_id: object, errors: list[str]) -> None:
    parsed = urlparse(value)
    if parsed.scheme != "https" or not parsed.hostname or parsed.username or parsed.password:
        errors.append(f"fish {fish_id}: {label} must be an absolute credential-free HTTPS URL")
    elif parsed.hostname.lower() not in hosts:
        errors.append(f"fish {fish_id}: {label} host is not allowlisted: {parsed.hostname}")


def validate_manifest(manifest: dict) -> list[str]:
    errors: list[str] = []
    if manifest.get("schemaVersion") != 1:
        errors.append("schemaVersion must be 1")
    reviewed_at = manifest.get("reviewedAt")
    if not isinstance(reviewed_at, str):
        errors.append("reviewedAt must be an ISO-8601 date")
    else:
        try:
            if date.fromisoformat(reviewed_at).isoformat() != reviewed_at:
                errors.append("reviewedAt must be an ISO-8601 date")
        except ValueError:
            errors.append("reviewedAt must be an ISO-8601 date")

    items = manifest.get("items")
    if not isinstance(items, list):
        return errors + ["items must be an array"]

    by_id: dict[int, dict] = {}
    image_urls: set[str] = set()
    ready_count = 0
    blocked_count = 0

    for item in items:
        if not isinstance(item, dict):
            errors.append("every item must be an object")
            continue
        fish_id = item.get("fishId")
        if not isinstance(fish_id, int) or isinstance(fish_id, bool):
            errors.append(f"invalid fishId: {fish_id!r}")
            continue
        if fish_id in by_id:
            errors.append(f"duplicate fishId: {fish_id}")
            continue
        by_id[fish_id] = item

        expected_identity = EXPECTED.get(fish_id)
        if expected_identity is None:
            errors.append(f"unexpected fishId: {fish_id}")
        elif (item.get("name"), item.get("slug")) != expected_identity:
            errors.append(
                f"fish {fish_id}: identity drift, expected {expected_identity!r} "
                f"but got {(item.get('name'), item.get('slug'))!r}"
            )

        status = item.get("status")
        if status == "READY":
            ready_count += 1
            if item.get("role") != "PRIMARY" or item.get("imageOrder") != 0:
                errors.append(f"fish {fish_id}: curated representative must be PRIMARY at order 0")
            if item.get("commercialUseConfirmed") is not True:
                errors.append(f"fish {fish_id}: commercialUseConfirmed must be true")
            if not require_text(item, "scientificName", errors):
                errors.append(f"fish {fish_id}: READY media requires species-level identity")
            url = require_text(item, "url", errors)
            source_url = require_text(item, "sourceUrl", errors)
            require_text(item, "credit", errors)
            license_name = require_text(item, "license", errors)
            alt = require_text(item, "alt", errors)
            if url:
                require_https(url, ALLOWED_IMAGE_HOSTS, "url", fish_id, errors)
                if url in image_urls:
                    errors.append(f"fish {fish_id}: duplicate image url")
                image_urls.add(url)
            if source_url:
                require_https(source_url, ALLOWED_SOURCE_HOSTS, "sourceUrl", fish_id, errors)
            if license_name and license_name not in ALLOWED_LICENSES:
                errors.append(f"fish {fish_id}: license is not in the commercial-use allowlist")
            if alt and item.get("name") not in alt:
                errors.append(f"fish {fish_id}: alt must identify the catalog fish name")
            for field in ("width", "height"):
                value = item.get(field)
                if not isinstance(value, int) or isinstance(value, bool) or value <= 0:
                    errors.append(f"fish {fish_id}: {field} must be a positive integer")
            focal = item.get("focalPoint")
            if not isinstance(focal, dict):
                errors.append(f"fish {fish_id}: focalPoint must be an object")
            else:
                for axis in ("x", "y"):
                    value = focal.get(axis)
                    if not isinstance(value, (int, float)) or isinstance(value, bool) or not 0 <= value <= 1:
                        errors.append(f"fish {fish_id}: focalPoint.{axis} must be within 0..1")
            # docs/15 M3: 자체 호스팅 사본. 원본 url·출처 필드는 그대로 두고 추가로만 기록한다.
            hosted = item.get("hosted")
            if not isinstance(hosted, dict):
                errors.append(f"fish {fish_id}: READY media requires a hosted copy (docs/15 M3)")
            else:
                expected_hosted_url = f"{HOSTED_IMAGE_ORIGIN}/fish/{item.get('slug')}.jpg"
                if hosted.get("url") != expected_hosted_url:
                    errors.append(f"fish {fish_id}: hosted.url must be {expected_hosted_url}")
                for field in ("width", "height"):
                    value = hosted.get(field)
                    if not isinstance(value, int) or isinstance(value, bool) or value <= 0:
                        errors.append(f"fish {fish_id}: hosted.{field} must be a positive integer")
        elif status == "BLOCKED":
            blocked_count += 1
            require_text(item, "reason", errors)
            placeholder_alt = require_text(item, "placeholderAlt", errors)
            if placeholder_alt and item.get("name") not in placeholder_alt:
                errors.append(f"fish {fish_id}: placeholderAlt must identify the catalog fish name")
            if any(field in item for field in ("url", "sourceUrl", "credit", "license")):
                errors.append(f"fish {fish_id}: BLOCKED item must not carry unverified media fields")
        else:
            errors.append(f"fish {fish_id}: status must be READY or BLOCKED")

    missing_ids = sorted(set(EXPECTED) - set(by_id))
    if missing_ids:
        errors.append(f"missing fish IDs: {missing_ids}")

    coverage = manifest.get("coverage")
    if coverage != {"ready": ready_count, "blocked": blocked_count}:
        errors.append(
            f"coverage does not match items: expected ready={ready_count}, blocked={blocked_count}"
        )
    return errors


def main() -> int:
    manifest_path = Path(sys.argv[1]) if len(sys.argv) > 1 else (
        Path(__file__).resolve().parents[1] / "config" / "fish_image_manifest.json"
    )
    try:
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        print(f"manifest read failed: {exc}", file=sys.stderr)
        return 1

    errors = validate_manifest(manifest)
    if errors:
        for error in errors:
            print(f"ERROR: {error}", file=sys.stderr)
        return 1

    coverage = manifest["coverage"]
    print(
        f"fish image manifest valid: {coverage['ready']} ready, "
        f"{coverage['blocked']} intentionally blocked"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
