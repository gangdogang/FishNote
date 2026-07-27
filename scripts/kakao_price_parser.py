#!/usr/bin/env python3
"""Parse KakaoTalk exported chat text into shop-price observation CSV.

KakaoTalk does not provide an official API for reading Open Chat messages.
This script supports the safer workflow: export the chat as text, then parse
the morning price messages while preserving raw text for later correction.
"""

from __future__ import annotations

import argparse
import csv
import datetime as dt
import json
import os
import re
import subprocess
import sys
from dataclasses import dataclass
from decimal import Decimal, InvalidOperation
from pathlib import Path
from typing import Any, Dict, Iterable, List, Mapping, Optional, Sequence, Tuple
from urllib.error import HTTPError, URLError
from urllib.parse import urlparse
from urllib.request import urlopen


DEFAULT_SOURCE_TYPE = "kakao_openchat"
ALIAS_MANIFEST_SCHEMA_VERSION = 1
ALIAS_MANIFEST_SOURCE = "fish_alias"
DEFAULT_ALIAS_MANIFEST = os.environ.get(
    "FISHNOTE_ALIAS_MANIFEST_URL",
    "http://localhost:8080/api/v1/fish/aliases/price-parser",
)
DATE_BANNER_RE = re.compile(r"^-+\s*(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일.*-+$")
BRACKET_MESSAGE_RE = re.compile(r"^\[(?P<speaker>.+?)\]\s*\[(?P<ampm>오전|오후)\s*(?P<hour>\d{1,2}):(?P<minute>\d{2})\]\s*(?P<text>.*)$")
PC_MESSAGE_RE = re.compile(
    r"^(?P<year>\d{4})[.년/-]\s*(?P<month>\d{1,2})[.월/-]\s*(?P<day>\d{1,2})[.일]?\s+"
    r"(?P<ampm>오전|오후)?\s*(?P<hour>\d{1,2}):(?P<minute>\d{2}),?\s*(?P<speaker>[^:]+?)\s*[:：]\s*(?P<text>.*)$"
)
PRICE_VALUE = r"\d{1,3}(?:,\d{3})+|\d{1,3}\.\d{3}(?:\.\d{3})?|\d+(?:\.\d+)?\s*만(?:\s*\d{1,3}\s*천)?|\d+\s*만\s*\d{1,3}?\s*천?|\d{4,7}"
PRICE_TOKEN_RE = re.compile(rf"(?<![\d.])({PRICE_VALUE})(?![\d.])")
RANGE_RE = re.compile(
    rf"(?P<a>{PRICE_VALUE})"
    r"\s*(?:~|-|–|—|부터|에서)\s*"
    rf"(?P<b>{PRICE_VALUE})"
)
DATE_IN_TEXT_RE = re.compile(r"(?P<year>\d{4})년\s*(?P<month>\d{1,2})월\s*(?P<day>\d{1,2})일")
KNOWN_SHOPS = ("윤호수산", "성전물산", "참조은수산")
ORIGIN_HEADER_RE = re.compile(r"(국내산|중국산|중국|일본산|일본|노르웨이|제주산|제주|완도|통영|흑산도)")
NOISE_TOKENS = (
    "대표",
    "연락처",
    "주소",
    "영업시간",
    "계좌",
    "은행",
    "방문",
    "픽업",
    "카카오퀵",
    "택배",
    "운임",
    "상세 주소",
    "공동현관",
    "받으시는",
    "희망 생선",
    "원물",
    "오로시",
    "회뜨기",
    "손질",
    "세꼬시",
    "포뜨기",
    "포장비",
    "진공포장",
    "도착시간",
)


@dataclass
class ChatMessage:
    observed_at: str
    speaker: str
    text: str


@dataclass(frozen=True)
class ShopPriceRow:
    observed_at: str
    source_type: str
    source_name: str
    speaker: str
    canonical_fish_name: str
    reported_name: str
    condition: str
    origin: str
    size_grade: str
    unit: str
    price_min_krw: str
    price_max_krw: str
    confidence: str
    raw_text: str


def normalize_space(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip()


def parse_time(ampm: Optional[str], hour: str, minute: str) -> Tuple[int, int]:
    h = int(hour)
    m = int(minute)
    if ampm == "오후" and h != 12:
        h += 12
    elif ampm == "오전" and h == 12:
        h = 0
    return h, m


class AliasManifestError(RuntimeError):
    """Raised when the DB-derived fish-alias manifest cannot be trusted."""


def compact_alias(value: str) -> str:
    return "".join(char for char in value if not char.isspace())


def sort_aliases(items: Iterable[Tuple[str, str]]) -> Dict[str, str]:
    aliases: Dict[str, str] = {}
    for raw_alias, raw_canonical in items:
        alias = compact_alias(raw_alias.strip())
        canonical = raw_canonical.strip()
        if not alias or not canonical:
            raise AliasManifestError("Alias manifest contains a blank alias or canonical fish name")
        previous = aliases.setdefault(alias, canonical)
        if previous != canonical:
            raise AliasManifestError(f"Alias {alias!r} maps to more than one canonical fish name")

    if not aliases:
        raise AliasManifestError("Alias manifest is empty")

    # Shared with ShopPriceParser: compact length descending, then alias/canonical lexical order.
    return dict(sorted(aliases.items(), key=lambda item: (-len(item[0]), item[0], item[1])))


def read_alias_manifest(source: str) -> Mapping[str, Any]:
    parsed = urlparse(source)
    try:
        if parsed.scheme in {"http", "https", "file"}:
            with urlopen(source, timeout=10) as response:
                payload = response.read().decode("utf-8")
        elif parsed.scheme:
            raise AliasManifestError(f"Unsupported alias manifest URL scheme: {parsed.scheme}")
        else:
            payload = Path(source).read_text(encoding="utf-8")
    except (HTTPError, URLError, OSError, UnicodeDecodeError) as exc:
        raise AliasManifestError(f"Could not read alias manifest from {source!r}") from exc

    try:
        document = json.loads(payload)
    except json.JSONDecodeError as exc:
        raise AliasManifestError("Alias manifest is not valid JSON") from exc
    if not isinstance(document, dict):
        raise AliasManifestError("Alias manifest root must be a JSON object")
    return document


def load_aliases(source: str) -> Dict[str, str]:
    document = read_alias_manifest(source)
    if document.get("schemaVersion") != ALIAS_MANIFEST_SCHEMA_VERSION:
        raise AliasManifestError("Unsupported alias manifest schemaVersion")
    if document.get("source") != ALIAS_MANIFEST_SOURCE:
        raise AliasManifestError("Alias manifest was not derived from fish_alias")

    raw_items = document.get("items")
    if not isinstance(raw_items, list):
        raise AliasManifestError("Alias manifest items must be a JSON array")
    items: List[Tuple[str, str]] = []
    for item in raw_items:
        if not isinstance(item, dict):
            raise AliasManifestError("Every alias manifest item must be a JSON object")
        alias = item.get("alias")
        canonical = item.get("canonicalFishName")
        if not isinstance(alias, str) or not isinstance(canonical, str):
            raise AliasManifestError("Alias manifest item fields must be strings")
        items.append((alias, canonical))
    return sort_aliases(items)


def read_text(path: Path) -> str:
    for encoding in ("utf-8-sig", "utf-8", "cp949"):
        try:
            return path.read_text(encoding=encoding)
        except UnicodeDecodeError:
            continue
    return path.read_text(encoding="utf-8", errors="replace")


def read_clipboard() -> str:
    try:
        result = subprocess.run(["pbpaste"], check=True, capture_output=True, text=True)
    except (FileNotFoundError, subprocess.CalledProcessError) as exc:
        raise RuntimeError("clipboard input is only supported on macOS with pbpaste available") from exc
    return result.stdout


def parse_messages(text: str, fallback_date: str) -> List[ChatMessage]:
    current_date = dt.date.fromisoformat(fallback_date)
    messages: List[ChatMessage] = []
    current: Optional[ChatMessage] = None

    for raw_line in text.splitlines():
        line = raw_line.rstrip()
        if not line:
            continue

        banner = DATE_BANNER_RE.match(line)
        if banner:
            current_date = dt.date(int(banner.group(1)), int(banner.group(2)), int(banner.group(3)))
            current = None
            continue

        match = BRACKET_MESSAGE_RE.match(line)
        if match:
            hour, minute = parse_time(match.group("ampm"), match.group("hour"), match.group("minute"))
            observed = dt.datetime.combine(current_date, dt.time(hour, minute)).isoformat(timespec="minutes")
            current = ChatMessage(observed_at=observed, speaker=match.group("speaker").strip(), text=match.group("text").strip())
            messages.append(current)
            continue

        match = PC_MESSAGE_RE.match(line)
        if match:
            date = dt.date(int(match.group("year")), int(match.group("month")), int(match.group("day")))
            hour, minute = parse_time(match.group("ampm"), match.group("hour"), match.group("minute"))
            observed = dt.datetime.combine(date, dt.time(hour, minute)).isoformat(timespec="minutes")
            current = ChatMessage(observed_at=observed, speaker=match.group("speaker").strip(), text=match.group("text").strip())
            messages.append(current)
            continue

        if current:
            current.text = f"{current.text}\n{line}".strip()

    if messages:
        return messages
    return parse_plain_price_sheets(text, fallback_date)


def parse_plain_price_sheets(text: str, fallback_date: str) -> List[ChatMessage]:
    segments: List[Tuple[str, List[str]]] = []
    current_shop = infer_shop_from_text(text) or "시세표"
    current_lines: List[str] = []

    for raw_line in text.splitlines():
        line = raw_line.rstrip()
        if not line:
            current_lines.append(line)
            continue
        line_shop = infer_shop_from_text(line)
        if line_shop and current_lines and line_shop != current_shop:
            segments.append((current_shop, current_lines))
            current_shop = line_shop
            current_lines = [line]
        else:
            if line_shop:
                current_shop = line_shop
            current_lines.append(line)

    if current_lines:
        segments.append((current_shop, current_lines))

    messages: List[ChatMessage] = []
    for shop, lines in segments:
        body = "\n".join(lines).strip()
        if not body:
            continue
        inferred_date = infer_date_from_text(body, fallback_date)
        observed = dt.datetime.combine(inferred_date, dt.time(8, 0)).isoformat(timespec="minutes")
        messages.append(ChatMessage(observed_at=observed, speaker=shop, text=body))
    return messages


def infer_date_from_text(text: str, fallback_date: str) -> dt.date:
    match = DATE_IN_TEXT_RE.search(text)
    if match:
        return dt.date(int(match.group("year")), int(match.group("month")), int(match.group("day")))
    return dt.date.fromisoformat(fallback_date)


def infer_shop_from_text(text: str) -> str:
    for shop in KNOWN_SHOPS:
        if shop in text:
            return shop
    return ""


def parse_krw(token: str) -> Optional[int]:
    value = normalize_space(token).replace(",", "").replace("원", "")
    if re.fullmatch(r"\d{1,3}\.\d{3}(?:\.\d{3})?", value):
        return int(value.replace(".", ""))
    if "만" in value:
        parts = value.split("만", 1)
        try:
            total = Decimal(parts[0].strip()) * Decimal(10000)
        except InvalidOperation:
            return None
        rest = parts[1].strip()
        if rest:
            rest = rest.replace("천", "").strip()
            if rest:
                try:
                    total += Decimal(rest) * Decimal(1000)
                except InvalidOperation:
                    pass
        return int(total)
    try:
        return int(Decimal(value))
    except InvalidOperation:
        return None


def extract_price(line: str) -> Tuple[str, str, float]:
    line = strip_size_parentheses(line)
    explicit = re.search(r"(?:kg\s*)?(?P<value>" + PRICE_VALUE + r")\s*(?:원|만원)", line)
    if explicit:
        value = parse_krw(explicit.group("value"))
        if value is not None:
            return str(value), str(value), 0.9

    kg_man = re.search(r"kg\s*(?P<man>\d+(?:\.\d+)?)\b(?!\s*(?:kg|k|g|미|마리))", line, re.IGNORECASE)
    if kg_man:
        try:
            value = int(Decimal(kg_man.group("man")) * Decimal(10000))
            return str(value), str(value), 0.84
        except InvalidOperation:
            pass

    dash_match = re.search(r"[ㅡ:]\s*(?P<value>" + PRICE_VALUE + r")", line)
    if dash_match:
        value = parse_krw(dash_match.group("value"))
        if value is not None:
            return str(value), str(value), 0.9

    range_match = RANGE_RE.search(line)
    if range_match:
        first = parse_krw(range_match.group("a"))
        second = parse_krw(range_match.group("b"))
        if first is not None and second is not None:
            return str(min(first, second)), str(max(first, second)), 0.92

    values = [parse_krw(match.group(1)) for match in PRICE_TOKEN_RE.finditer(line)]
    values = [value for value in values if value is not None]
    if not values:
        return "", "", 0.0
    return str(min(values)), str(max(values)), 0.82 if len(values) == 1 else 0.88


def strip_size_parentheses(line: str) -> str:
    return re.sub(r"\([^)]*(?:kg|k|g|미|마리|↕|⬇)[^)]*\)", " ", line, flags=re.IGNORECASE)


def extract_alias(line: str, aliases: Dict[str, str]) -> Tuple[str, str]:
    compact_chars: List[str] = []
    source_offsets: List[int] = []
    for source_offset, char in enumerate(line):
        if not char.isspace():
            compact_chars.append(char)
            source_offsets.append(source_offset)
    compact = "".join(compact_chars)

    best: Optional[Tuple[Tuple[int, int, str, str], str, int]] = None
    for alias, canonical in aliases.items():
        compacted_alias = compact_alias(alias)
        compact_start = compact.find(compacted_alias)
        if compacted_alias and compact_start >= 0:
            # Longest alias wins; equal lengths use the earliest occurrence, then lexical order.
            precedence = (-len(compacted_alias), compact_start, compacted_alias, canonical)
            candidate = (precedence, canonical, len(compacted_alias))
            if best is None or candidate[0] < best[0]:
                best = candidate

    if best is None:
        return "", ""

    precedence, canonical, alias_length = best
    compact_start = precedence[1]
    source_start = source_offsets[compact_start]
    source_end = source_offsets[compact_start + alias_length - 1] + 1
    return canonical, line[source_start:source_end]


def extract_condition(line: str) -> str:
    tokens = []
    for token in ("활", "선", "냉", "양식", "자연산", "국산", "수입", "숙성"):
        if token in line:
            tokens.append(token)
    return "/".join(tokens)


def extract_origin(line: str) -> str:
    for token in ("흑산도", "제주", "완도", "통영", "거제", "여수", "목포", "진도", "군산", "서천", "포항", "일본산", "일본", "중국산", "중국", "노르웨이", "국내산", "국내", "국산", "수입"):
        if token in line:
            return token.replace("산", "") if token in {"일본산", "중국산", "국내산"} else token
    return ""


def extract_unit(line: str) -> str:
    if re.search(r"kg|키로|킬로", line, re.IGNORECASE):
        return "kg"
    if re.search(r"마리|미\b", line):
        return "마리"
    if "팩" in line:
        return "팩"
    if "박스" in line or "box" in line.lower():
        return "박스"
    return ""


def extract_size_grade(line: str) -> str:
    match = re.search(
        r"(\d+(?:\.\d+)?\s*(?:~|-)\s*\d+(?:\.\d+)?\s*(?:kg|k|g|키로|킬로)|"
        r"\d+(?:\.\d+)?\s*(?:kg|k|g|키로|킬로)|"
        r"\d+\s*~\s*\d+\s*미|\d+\s*/\s*\d+\s*미)",
        line,
        re.IGNORECASE,
    )
    if match:
        return normalize_space(match.group(1))

    without_origin = re.sub(r"국내산|중국산|중국|일본산|일본|노르웨이|제주산|제주|완도|통영|흑산도", " ", line)
    match = re.search(r"(SSSS|SSS|SS|S|특대|대|중|소)", without_origin, re.IGNORECASE)
    return normalize_space(match.group(1)) if match else ""


def iter_candidate_lines(message: ChatMessage) -> Iterable[str]:
    for line in message.text.splitlines():
        cleaned = normalize_space(line)
        if cleaned and not is_noise_line(cleaned):
            yield cleaned


def is_noise_line(line: str) -> bool:
    return any(token in line for token in NOISE_TOKENS)


def is_origin_section(line: str) -> bool:
    stripped = re.sub(r"[^가-힣A-Za-z]", "", line)
    return stripped in {"국내산", "중국", "중국산", "일본", "일본산", "노르웨이", "제주산"}


def normalize_origin_section(line: str) -> str:
    match = ORIGIN_HEADER_RE.search(line)
    if not match:
        return ""
    value = match.group(1)
    if value == "국내산":
        return "국내"
    return value.replace("산", "")


def is_farming_section(line: str) -> bool:
    stripped = re.sub(r"[^가-힣A-Za-z]", "", line)
    return stripped in {"양식", "양식산", "자연산", "자연", "활어양식", "자연산활어"}


def normalize_farming_section(line: str) -> str:
    if "자연" in line:
        return "자연산"
    if "양식" in line:
        return "양식"
    return ""


def enrich_line(line: str, origin_context: str, farming_context: str) -> str:
    enriched = line
    if origin_context and not extract_origin(line):
        enriched = f"{origin_context} {enriched}"
    if farming_context and "양식" not in line and "자연산" not in line:
        enriched = f"{farming_context} {enriched}"
    return enriched


def within_hour_window(observed_at: str, start_hour: int, end_hour: int) -> bool:
    hour = dt.datetime.fromisoformat(observed_at).hour
    return start_hour <= hour <= end_hour


def parse_prices(
    messages: Sequence[ChatMessage],
    aliases: Dict[str, str],
    source_type: str,
    source_name: str,
    start_hour: int,
    end_hour: int,
) -> List[ShopPriceRow]:
    rows: List[ShopPriceRow] = []
    seen = set()
    for message in messages:
        if not within_hour_window(message.observed_at, start_hour, end_hour):
            continue
        message_source_name = infer_shop_from_text(message.text) or source_name
        origin_context = ""
        farming_context = ""
        for line in iter_candidate_lines(message):
            if is_origin_section(line):
                origin_context = normalize_origin_section(line)
                continue
            if is_farming_section(line):
                farming_context = normalize_farming_section(line)
                continue
            line_for_parse = enrich_line(line, origin_context, farming_context)
            canonical, reported = extract_alias(line_for_parse, aliases)
            if not canonical:
                continue
            price_min, price_max, confidence = extract_price(line_for_parse)
            if not price_min:
                continue
            row = ShopPriceRow(
                observed_at=message.observed_at,
                source_type=source_type,
                source_name=message_source_name,
                speaker=message.speaker,
                canonical_fish_name=canonical,
                reported_name=reported,
                condition=extract_condition(line_for_parse),
                origin=extract_origin(line_for_parse),
                size_grade=extract_size_grade(line_for_parse),
                unit=extract_unit(line_for_parse),
                price_min_krw=price_min,
                price_max_krw=price_max,
                confidence=f"{confidence:.2f}",
                raw_text=line,
            )
            key = tuple(getattr(row, field) for field in row.__dataclass_fields__)
            if key not in seen:
                seen.add(key)
                rows.append(row)
    return rows


def write_csv(path: Path, rows: Sequence[ShopPriceRow]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fieldnames = list(ShopPriceRow.__dataclass_fields__.keys())
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames, lineterminator="\n")
        writer.writeheader()
        for row in rows:
            writer.writerow({field: getattr(row, field) for field in fieldnames})


def parse_args(argv: Optional[Sequence[str]] = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Parse KakaoTalk chat export into FishNote price CSV.")
    parser.add_argument("input", nargs="?", help="KakaoTalk exported .txt file. Omit when using --clipboard or --stdin.")
    parser.add_argument("--out", help="Output CSV path. Defaults to data/shop-prices/<input-stem>.csv")
    parser.add_argument("--clipboard", action="store_true", help="Read raw price text from the macOS clipboard.")
    parser.add_argument("--stdin", action="store_true", help="Read raw price text from standard input.")
    parser.add_argument(
        "--alias-manifest",
        default=DEFAULT_ALIAS_MANIFEST,
        help=(
            "DB-derived fish alias manifest URL or JSON path "
            f"(default: {DEFAULT_ALIAS_MANIFEST}; override with FISHNOTE_ALIAS_MANIFEST_URL)"
        ),
    )
    parser.add_argument("--fallback-date", default=dt.date.today().isoformat(), help="Date for exports that only contain times")
    parser.add_argument("--source-name", default="노량진 오픈채팅", help="Human-readable source name")
    parser.add_argument("--source-type", default=DEFAULT_SOURCE_TYPE, help="Source type stored in CSV")
    parser.add_argument("--start-hour", type=int, default=6, help="Earliest message hour to parse")
    parser.add_argument("--end-hour", type=int, default=11, help="Latest message hour to parse")
    return parser.parse_args(argv)


def main(argv: Optional[Sequence[str]] = None) -> int:
    args = parse_args(argv)
    if args.clipboard and args.stdin:
        raise SystemExit("--clipboard and --stdin cannot be used together")
    if args.clipboard:
        raw_text = read_clipboard()
        default_stem = dt.date.today().isoformat()
    elif args.stdin:
        raw_text = sys.stdin.read()
        default_stem = dt.date.today().isoformat()
    else:
        if not args.input:
            raise SystemExit("input file is required unless --clipboard or --stdin is used")
        input_path = Path(args.input)
        raw_text = read_text(input_path)
        default_stem = input_path.stem

    out_path = Path(args.out) if args.out else Path("data") / "shop-prices" / f"{default_stem}.csv"
    aliases = load_aliases(args.alias_manifest)
    messages = parse_messages(raw_text, args.fallback_date)
    rows = parse_prices(messages, aliases, args.source_type, args.source_name, args.start_hour, args.end_hour)
    write_csv(out_path, rows)
    print(f"Parsed {len(messages)} messages; wrote {len(rows)} price rows to {out_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
