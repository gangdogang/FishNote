package com.fishnote.price;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.OffsetDateTime;
import java.util.List;
import org.junit.jupiter.api.Test;

class ShopPriceParserTest {

    private final ShopPriceParser parser = new ShopPriceParser();

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
}
