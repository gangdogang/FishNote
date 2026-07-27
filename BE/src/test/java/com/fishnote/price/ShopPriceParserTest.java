package com.fishnote.price;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class ShopPriceParserTest {

    private final ShopPriceParser parser = new ShopPriceParser(Map.ofEntries(
            Map.entry("광어", "광어"),
            Map.entry("제주광어", "광어"),
            Map.entry("찰광어", "광어"),
            Map.entry("연어", "연어"),
            Map.entry("농어", "농어"),
            Map.entry("전어", "전어"),
            Map.entry("넙치", "광어"),
            Map.entry("도미", "참돔"),
            Map.entry("하모", "갯장어"),
            Map.entry("아나고", "붕장어"),
            Map.entry("밀치", "가숭어"),
            Map.entry("점성어", "점성어")));

    @Test
    void parsesShopPriceSheetAndSkipsOrderAndProcessingFeeLines() {
        String text =
                """
                2026년07월13일 윤호수산 시세단가

                제주광어2.4~2.5kㅡ32000
                ###중국##
                찰광어1.6~1.8kㅡ20000
                ###노르웨이###
                연어1k20000(6~7k사이)10시전에주문주세요

                ◇손질 비용◇
                연어손질비용kg당2000(업체마다조금다를수도있음)
                전어머리내장손질 ㅡ5000
                """;

        List<ParsedShopPrice> rows = parser.parse(text, OffsetDateTime.parse("2026-07-13T08:00:00+09:00"));

        assertThat(rows).hasSize(3);
        assertThat(rows).extracting(ParsedShopPrice::canonicalFishName).containsExactly("광어", "광어", "연어");
        assertThat(rows).extracting(ParsedShopPrice::priceMinKrw).containsExactly(32000, 20000, 20000);
        assertThat(rows).extracting(ParsedShopPrice::origin).containsExactly("제주", "중국", "노르웨이");
        assertThat(rows).extracting(ParsedShopPrice::rawText).noneMatch(line -> line.contains("손질"));
    }

    @Test
    void keepsSeparateSourceNamesWhenMultipleShopSheetsArePastedTogether() {
        String text =
                """
                2026년07월14일 윤호수산 시세단가
                제주광어2.4~2.5kㅡ32000

                ●성전물산 오늘의 판매 목록●
                🅰️광어 (제주산)(1번)  kg3.2만원   (2.0-2.4kg↕️)(반/반)
                🅰️농 어                     kg 2.4만원   (2.0-2.5↕️kg)
                """;

        List<ParsedShopPrice> rows = parser.parse(text, OffsetDateTime.parse("2026-07-14T08:00:00+09:00"));

        assertThat(rows).hasSize(3);
        assertThat(rows).extracting(ParsedShopPrice::sourceName)
                .containsExactly("윤호수산", "성전물산", "성전물산");
    }

    @Test
    void appliesDomesticOriginAndFarmingSectionContexts() {
        String text =
                """
                2026년07월14일 윤호수산 시세단가
                ###국내산###
                ###양식###
                광어2.4~2.5kㅡ32000
                ###자연산###
                광어1.5kㅡ25000
                """;

        List<ParsedShopPrice> rows = parser.parse(text, OffsetDateTime.parse("2026-07-14T08:00:00+09:00"));

        assertThat(rows).hasSize(2);
        assertThat(rows).extracting(ParsedShopPrice::origin).containsExactly("국내", "국내");
        assertThat(rows).extracting(ParsedShopPrice::condition).containsExactly("양식", "자연산");
    }

    @Test
    void resolvesCatalogAliasesFromTheInjectedSingleSource() {
        String text =
                """
                넙치1kgㅡ21000
                도미1kgㅡ22000
                하모1kgㅡ23000
                아나고1kgㅡ24000
                밀치1kgㅡ25000
                """;

        List<ParsedShopPrice> rows = parser.parse(
                text,
                OffsetDateTime.parse("2026-07-22T08:00:00+09:00"));

        assertThat(rows)
                .extracting(ParsedShopPrice::canonicalFishName)
                .containsExactly("광어", "참돔", "갯장어", "붕장어", "가숭어");
        assertThat(rows)
                .extracting(ParsedShopPrice::reportedName)
                .containsExactly("넙치", "도미", "하모", "아나고", "밀치");
    }

    @Test
    void equalLengthAliasesUseTheEarliestOccurrenceRegardlessOfMapOrder() {
        List<ParsedShopPrice> rows = parser.parse(
                "연어 광어1kgㅡ21000\n광어 연어1kgㅡ22000",
                OffsetDateTime.parse("2026-07-22T08:00:00+09:00"));

        assertThat(rows)
                .extracting(ParsedShopPrice::canonicalFishName)
                .containsExactly("연어", "광어");
        assertThat(rows)
                .extracting(ParsedShopPrice::reportedName)
                .containsExactly("연어", "광어");
    }

    @Test
    void preservesWhitespaceFromTheMatchedSourceAliasInReportedName() {
        List<ParsedShopPrice> rows = parser.parse(
                "점 성 어1kgㅡ25000\n제주 광어1kgㅡ32000",
                OffsetDateTime.parse("2026-07-22T08:00:00+09:00"));

        assertThat(rows)
                .extracting(ParsedShopPrice::canonicalFishName)
                .containsExactly("점성어", "광어");
        assertThat(rows)
                .extracting(ParsedShopPrice::reportedName)
                .containsExactly("점 성 어", "제주 광어");
    }

    @Test
    void matchesTheSharedJavaPythonAliasParityCases() throws Exception {
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(
                getClass().getResourceAsStream("/price-parser-alias-parity.tsv"),
                StandardCharsets.UTF_8))) {
            for (String fixture : reader.lines().skip(1).toList()) {
                String[] fields = fixture.split("\\t", -1);
                List<ParsedShopPrice> rows = parser.parse(
                        fields[0],
                        OffsetDateTime.parse("2026-07-22T08:00:00+09:00"));

                assertThat(rows).as(fields[0]).singleElement().satisfies(row -> {
                    assertThat(row.canonicalFishName()).isEqualTo(fields[1]);
                    assertThat(row.reportedName()).isEqualTo(fields[2]);
                });
            }
        }
    }
}
