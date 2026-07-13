package com.fishnote.price;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.springframework.stereotype.Service;

@Service
public class ShopPriceParser {

    static final ZoneOffset KST = ZoneOffset.ofHours(9);

    private static final String DEFAULT_SOURCE_TYPE = "telegram_bot";
    private static final List<String> KNOWN_SHOPS = List.of("윤호수산", "성전물산", "참조은수산");
    private static final List<String> NOISE_TOKENS = List.of(
            "대표", "연락처", "주소", "영업시간", "계좌", "은행", "방문", "픽업", "카카오퀵", "택배", "운임",
            "상세 주소", "공동현관", "받으시는", "희망 생선", "원물", "오로시", "회뜨기", "손질", "세꼬시",
            "포뜨기", "포장비", "진공포장", "도착시간");
    private static final Pattern DATE_IN_TEXT =
            Pattern.compile("(?<year>\\d{4})년\\s*(?<month>\\d{1,2})월\\s*(?<day>\\d{1,2})일");
    private static final Pattern ORIGIN_HEADER =
            Pattern.compile("(국내산|중국산|중국|일본산|일본|노르웨이|제주산|제주|완도|통영|흑산도)");
    private static final Pattern PRICE_TOKEN = Pattern.compile(
            "(?<![\\d.])(\\d{1,3}(?:,\\d{3})+|\\d{1,3}\\.\\d{3}(?:\\.\\d{3})?|\\d+(?:\\.\\d+)?\\s*만(?:\\s*\\d{1,3}\\s*천)?|\\d+\\s*만\\s*\\d{1,3}?\\s*천?|\\d{4,7})(?![\\d.])");
    private static final Pattern PRICE_RANGE = Pattern.compile(
            "(?<a>\\d{1,3}(?:,\\d{3})+|\\d{1,3}\\.\\d{3}(?:\\.\\d{3})?|\\d+(?:\\.\\d+)?\\s*만(?:\\s*\\d{1,3}\\s*천)?|\\d+\\s*만\\s*\\d{1,3}?\\s*천?|\\d{4,7})\\s*(?:~|-|–|—|부터|에서)\\s*(?<b>\\d{1,3}(?:,\\d{3})+|\\d{1,3}\\.\\d{3}(?:\\.\\d{3})?|\\d+(?:\\.\\d+)?\\s*만(?:\\s*\\d{1,3}\\s*천)?|\\d+\\s*만\\s*\\d{1,3}?\\s*천?|\\d{4,7})");
    private static final Pattern SIZE_GRADE = Pattern.compile(
            "(\\d+(?:\\.\\d+)?\\s*(?:~|-)\\s*\\d+(?:\\.\\d+)?\\s*(?:kg|k|g|키로|킬로)|"
                    + "\\d+(?:\\.\\d+)?\\s*(?:kg|k|g|키로|킬로)|"
                    + "\\d+\\s*~\\s*\\d+\\s*미|\\d+\\s*/\\s*\\d+\\s*미)",
            Pattern.CASE_INSENSITIVE);
    private static final Pattern GRADE = Pattern.compile("(SSSS|SSS|SS|S|특대|대|중|소)", Pattern.CASE_INSENSITIVE);

    private final Map<String, String> aliases;

    public ShopPriceParser() {
        this.aliases = buildAliases();
    }

    public List<ParsedShopPrice> parse(String text, OffsetDateTime fallbackObservedAt) {
        return parse(text, fallbackObservedAt, DEFAULT_SOURCE_TYPE, "");
    }

    public List<ParsedShopPrice> parse(
            String text, OffsetDateTime fallbackObservedAt, String sourceType, String fallbackSourceName) {
        if (text == null || text.isBlank()) {
            return List.of();
        }

        return splitByShop(text, fallbackSourceName).stream()
                .flatMap(segment -> parseSegment(segment.text(), fallbackObservedAt, sourceType, segment.sourceName()).stream())
                .distinct()
                .toList();
    }

    private List<ParsedShopPrice> parseSegment(
            String text, OffsetDateTime fallbackObservedAt, String sourceType, String fallbackSourceName) {
        OffsetDateTime observedAt = inferObservedAt(text, fallbackObservedAt);
        String sourceName = firstNonBlank(inferShopFromText(text), fallbackSourceName);
        String speaker = firstNonBlank(sourceName, "텔레그램");
        List<ParsedShopPrice> rows = new ArrayList<>();
        String originContext = "";

        for (String rawLine : text.split("\\R")) {
            String line = normalizeSpace(rawLine);
            if (line.isBlank() || isNoiseLine(line)) {
                continue;
            }
            if (isOriginSection(line)) {
                originContext = normalizeOriginSection(line);
                continue;
            }

            String lineForParse = enrichLine(line, originContext);
            AliasMatch alias = extractAlias(lineForParse).orElse(null);
            if (alias == null) {
                continue;
            }
            PriceMatch price = extractPrice(lineForParse).orElse(null);
            if (price == null) {
                continue;
            }

            rows.add(new ParsedShopPrice(
                    observedAt,
                    sourceType,
                    sourceName,
                    speaker,
                    alias.canonicalFishName(),
                    alias.reportedName(),
                    extractCondition(lineForParse),
                    extractOrigin(lineForParse),
                    extractSizeGrade(lineForParse),
                    extractUnit(lineForParse),
                    price.minKrw(),
                    price.maxKrw(),
                    price.confidence(),
                    line));
        }

        return rows;
    }

    private List<ShopSegment> splitByShop(String text, String fallbackSourceName) {
        List<ShopSegment> segments = new ArrayList<>();
        List<String> currentLines = new ArrayList<>();
        String currentShop = firstNonBlank(inferShopFromText(text), fallbackSourceName);

        for (String rawLine : text.split("\\R")) {
            String lineShop = inferShopFromText(rawLine);
            if (!lineShop.isBlank() && !currentLines.isEmpty() && !lineShop.equals(currentShop)) {
                segments.add(new ShopSegment(firstNonBlank(currentShop, fallbackSourceName), String.join("\n", currentLines)));
                currentLines = new ArrayList<>();
            }
            if (!lineShop.isBlank()) {
                currentShop = lineShop;
            }
            currentLines.add(rawLine);
        }

        if (!currentLines.isEmpty()) {
            segments.add(new ShopSegment(firstNonBlank(currentShop, fallbackSourceName), String.join("\n", currentLines)));
        }
        return segments;
    }

    private OffsetDateTime inferObservedAt(String text, OffsetDateTime fallbackObservedAt) {
        Matcher match = DATE_IN_TEXT.matcher(text);
        if (match.find()) {
            LocalDate date = LocalDate.of(
                    Integer.parseInt(match.group("year")),
                    Integer.parseInt(match.group("month")),
                    Integer.parseInt(match.group("day")));
            return OffsetDateTime.of(date, LocalTime.of(8, 0), KST);
        }
        return fallbackObservedAt == null ? OffsetDateTime.now(KST) : fallbackObservedAt.withOffsetSameInstant(KST);
    }

    private String inferShopFromText(String text) {
        for (String shop : KNOWN_SHOPS) {
            if (text.contains(shop)) {
                return shop;
            }
        }
        return "";
    }

    private Optional<AliasMatch> extractAlias(String line) {
        String compact = line.replace(" ", "");
        for (Map.Entry<String, String> entry : aliases.entrySet()) {
            String alias = entry.getKey();
            if (!alias.isBlank() && compact.contains(alias.replace(" ", ""))) {
                return Optional.of(new AliasMatch(entry.getValue(), alias));
            }
        }
        return Optional.empty();
    }

    private Optional<PriceMatch> extractPrice(String line) {
        String stripped = stripSizeParentheses(line);
        Matcher explicit = Pattern.compile(
                        "(?:kg\\s*)?(?<value>\\d{1,3}(?:,\\d{3})+|\\d{1,3}\\.\\d{3}(?:\\.\\d{3})?|\\d+(?:\\.\\d+)?\\s*만(?:\\s*\\d{1,3}\\s*천)?|\\d+\\s*만\\s*\\d{1,3}?\\s*천?|\\d{4,7})\\s*(?:원|만원)")
                .matcher(stripped);
        if (explicit.find()) {
            return parseKrw(explicit.group("value")).map(value -> new PriceMatch(value, value, confidence("0.90")));
        }

        Matcher kgMan = Pattern.compile("kg\\s*(?<man>\\d+(?:\\.\\d+)?)\\b(?!\\s*(?:kg|k|g|미|마리))", Pattern.CASE_INSENSITIVE)
                .matcher(stripped);
        if (kgMan.find()) {
            int value = new BigDecimal(kgMan.group("man")).multiply(BigDecimal.valueOf(10000)).intValue();
            return Optional.of(new PriceMatch(value, value, confidence("0.84")));
        }

        Matcher dash = Pattern.compile("[ㅡ:]\\s*(?<value>\\d{1,3}(?:,\\d{3})+|\\d{1,3}\\.\\d{3}(?:\\.\\d{3})?|\\d+(?:\\.\\d+)?\\s*만(?:\\s*\\d{1,3}\\s*천)?|\\d+\\s*만\\s*\\d{1,3}?\\s*천?|\\d{4,7})")
                .matcher(stripped);
        if (dash.find()) {
            return parseKrw(dash.group("value")).map(value -> new PriceMatch(value, value, confidence("0.90")));
        }

        Matcher range = PRICE_RANGE.matcher(stripped);
        if (range.find()) {
            Optional<Integer> first = parseKrw(range.group("a"));
            Optional<Integer> second = parseKrw(range.group("b"));
            if (first.isPresent() && second.isPresent()) {
                return Optional.of(new PriceMatch(
                        Math.min(first.get(), second.get()), Math.max(first.get(), second.get()), confidence("0.92")));
            }
        }

        Matcher token = PRICE_TOKEN.matcher(stripped);
        List<Integer> values = new ArrayList<>();
        while (token.find()) {
            parseKrw(token.group(1)).ifPresent(values::add);
        }
        if (values.isEmpty()) {
            return Optional.empty();
        }
        int min = values.stream().min(Comparator.naturalOrder()).orElseThrow();
        int max = values.stream().max(Comparator.naturalOrder()).orElseThrow();
        return Optional.of(new PriceMatch(min, max, values.size() == 1 ? confidence("0.82") : confidence("0.88")));
    }

    private Optional<Integer> parseKrw(String token) {
        String value = normalizeSpace(token).replace(",", "").replace("원", "");
        if (value.matches("\\d{1,3}\\.\\d{3}(?:\\.\\d{3})?")) {
            return Optional.of(Integer.parseInt(value.replace(".", "")));
        }
        if (value.contains("만")) {
            String[] parts = value.split("만", 2);
            BigDecimal total = new BigDecimal(parts[0].trim()).multiply(BigDecimal.valueOf(10000));
            if (parts.length > 1) {
                String rest = parts[1].replace("천", "").trim();
                if (!rest.isBlank()) {
                    total = total.add(new BigDecimal(rest).multiply(BigDecimal.valueOf(1000)));
                }
            }
            return Optional.of(total.setScale(0, RoundingMode.DOWN).intValue());
        }
        return Optional.of(new BigDecimal(value).intValue());
    }

    private boolean isNoiseLine(String line) {
        return NOISE_TOKENS.stream().anyMatch(line::contains);
    }

    private boolean isOriginSection(String line) {
        String stripped = line.replaceAll("[^가-힣A-Za-z]", "");
        return List.of("국내산", "중국", "중국산", "일본", "일본산", "노르웨이", "제주산").contains(stripped);
    }

    private String normalizeOriginSection(String line) {
        Matcher match = ORIGIN_HEADER.matcher(line);
        if (!match.find()) {
            return "";
        }
        String value = match.group(1);
        if ("국내산".equals(value)) {
            return "국내";
        }
        return value.replace("산", "");
    }

    private String enrichLine(String line, String originContext) {
        if (originContext.isBlank() || !extractOrigin(line).isBlank()) {
            return line;
        }
        return originContext + " " + line;
    }

    private String extractCondition(String line) {
        List<String> tokens = new ArrayList<>();
        for (String token : List.of("활", "선", "냉", "양식", "자연산", "국산", "수입", "숙성")) {
            if (line.contains(token)) {
                tokens.add(token);
            }
        }
        return String.join("/", tokens);
    }

    private String extractOrigin(String line) {
        for (String token : List.of(
                "흑산도", "제주", "완도", "통영", "거제", "여수", "목포", "진도", "군산", "서천", "포항",
                "일본산", "일본", "중국산", "중국", "노르웨이", "국내산", "국산", "수입")) {
            if (line.contains(token)) {
                if (List.of("일본산", "중국산", "국내산").contains(token)) {
                    return token.replace("산", "");
                }
                return token;
            }
        }
        return "";
    }

    private String extractUnit(String line) {
        if (Pattern.compile("kg|키로|킬로", Pattern.CASE_INSENSITIVE).matcher(line).find()) {
            return "kg";
        }
        if (Pattern.compile("마리|미\\b").matcher(line).find()) {
            return "마리";
        }
        if (line.contains("팩")) {
            return "팩";
        }
        if (line.contains("박스") || line.toLowerCase().contains("box")) {
            return "박스";
        }
        return "";
    }

    private String extractSizeGrade(String line) {
        Matcher match = SIZE_GRADE.matcher(line);
        if (match.find()) {
            return normalizeSpace(match.group(1));
        }

        String withoutOrigin = line.replaceAll("국내산|중국산|중국|일본산|일본|노르웨이|제주산|제주|완도|통영|흑산도", " ");
        Matcher grade = GRADE.matcher(withoutOrigin);
        return grade.find() ? normalizeSpace(grade.group(1)) : "";
    }

    private String stripSizeParentheses(String line) {
        return line.replaceAll("\\([^)]*(?:kg|k|g|미|마리|↕|⬇)[^)]*\\)", " ");
    }

    private String normalizeSpace(String value) {
        return value.replaceAll("\\s+", " ").trim();
    }

    private String firstNonBlank(String first, String second) {
        return first == null || first.isBlank() ? (second == null ? "" : second) : first;
    }

    private BigDecimal confidence(String value) {
        return new BigDecimal(value);
    }

    private Map<String, String> buildAliases() {
        Map<String, String> map = new LinkedHashMap<>();
        addAliases(map, "광어", "광어", "찰광어", "제주광어");
        addAliases(map, "방어", "방어", "부시리", "잿방어");
        addAliases(map, "참돔", "참돔", "도미", "감성돔");
        addAliases(map, "농어", "농어", "대농어", "점농어");
        addAliases(map, "연어", "연어");
        addAliases(map, "우럭", "우럭");
        addAliases(map, "민어", "민어");
        addAliases(map, "전어", "전어");
        addAliases(map, "도다리", "도다리", "돌도다리");
        addAliases(map, "가자미", "가자미");
        addAliases(map, "붉바리", "붉바리");
        addAliases(map, "능성어", "능성어");
        addAliases(map, "자바리", "자바리", "대왕자바리");
        addAliases(map, "돌돔", "돌돔", "줄돔", "일본줄돔");
        addAliases(map, "전복", "전복", "완도전복");
        addAliases(map, "시마아지", "시마아지");
        addAliases(map, "어름돔", "어름돔");
        addAliases(map, "점성어", "점성어", "점 성 어");
        return map.entrySet().stream()
                .sorted((a, b) -> Integer.compare(b.getKey().length(), a.getKey().length()))
                .collect(LinkedHashMap::new, (result, entry) -> result.put(entry.getKey(), entry.getValue()), Map::putAll);
    }

    private void addAliases(Map<String, String> map, String canonicalFishName, String... aliases) {
        for (String alias : aliases) {
            map.put(alias, canonicalFishName);
        }
    }

    private record AliasMatch(String canonicalFishName, String reportedName) {}

    private record PriceMatch(int minKrw, int maxKrw, BigDecimal confidence) {}

    private record ShopSegment(String sourceName, String text) {}
}
