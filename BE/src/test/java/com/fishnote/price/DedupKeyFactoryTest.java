package com.fishnote.price;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.OffsetDateTime;
import org.junit.jupiter.api.Test;

class DedupKeyFactoryTest {

    @Test
    void normalizesNullAndBlankSourceNamesToTheSameIdentity() {
        String withNull = DedupKeyFactory.create(
                observedAt(), "telegram_bot", null, 25_000, 27_000, "🐟 아주 긴 원문");
        String withBlank = DedupKeyFactory.create(
                observedAt(), "telegram_bot", "  ", 25_000, 27_000, "🐟 아주 긴 원문");

        assertThat(withNull).isEqualTo(withBlank).hasSize(64);
    }

    @Test
    void usesTheInstantRatherThanThePresentedOffset() {
        String kst = DedupKeyFactory.create(
                observedAt(), "telegram_bot", "상회", 25_000, 27_000, "원문");
        String utc = DedupKeyFactory.create(
                observedAt().withOffsetSameInstant(java.time.ZoneOffset.UTC),
                "telegram_bot",
                "상회",
                25_000,
                27_000,
                "원문");

        assertThat(kst).isEqualTo(utc);
    }

    @Test
    void byteLengthPrefixPreventsDelimiterAndEmojiCollisions() {
        String first = DedupKeyFactory.create(
                observedAt(), "a|1:b", "🐟", 1, 2, "c|3:d");
        String second = DedupKeyFactory.create(
                observedAt(), "a", "1:b|🐟", 1, 2, "c|3:d");

        assertThat(first).isNotEqualTo(second);
    }

    private OffsetDateTime observedAt() {
        return OffsetDateTime.parse("2026-07-22T08:00:00+09:00");
    }
}
