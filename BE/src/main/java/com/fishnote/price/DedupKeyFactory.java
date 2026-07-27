package com.fishnote.price;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.OffsetDateTime;
import java.util.HexFormat;

/**
 * Builds the stable identity used to de-duplicate shop price observations.
 *
 * <p>Each component is UTF-8 byte-length prefixed so arbitrary source text cannot create delimiter
 * collisions. The matching compatibility trigger and backfill live in Flyway V15 and V16.
 */
public final class DedupKeyFactory {

    private static final String VERSION = "v1";

    private DedupKeyFactory() {}

    public static String create(ParsedShopPrice row) {
        return create(
                row.observedAt(),
                row.sourceType(),
                row.sourceName(),
                row.priceMinKrw(),
                row.priceMaxKrw(),
                row.rawText());
    }

    public static String create(ShopPriceObservation observation) {
        return create(
                observation.getObservedAt(),
                observation.getSourceType(),
                observation.getSourceName(),
                observation.getPriceMinKrw(),
                observation.getPriceMaxKrw(),
                observation.getRawText());
    }

    public static String create(
            OffsetDateTime observedAt,
            String sourceType,
            String sourceName,
            int priceMinKrw,
            int priceMaxKrw,
            String rawText) {
        if (observedAt == null) {
            throw new IllegalArgumentException("observedAt is required for price de-duplication");
        }

        String canonical = VERSION
                + "|" + part(Long.toString(observedAt.toInstant().toEpochMilli()))
                + "|" + part(normalizeRequired(sourceType))
                + "|" + part(normalizeNullable(sourceName))
                + "|" + part(Integer.toString(priceMinKrw))
                + "|" + part(Integer.toString(priceMaxKrw))
                + "|" + part(rawText == null ? "" : rawText);
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(digest.digest(canonical.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException ex) {
            throw new IllegalStateException("SHA-256 is unavailable", ex);
        }
    }

    private static String part(String value) {
        int byteLength = value.getBytes(StandardCharsets.UTF_8).length;
        return byteLength + ":" + value;
    }

    private static String normalizeRequired(String value) {
        return value == null ? "" : value.trim();
    }

    private static String normalizeNullable(String value) {
        return value == null || value.isBlank() ? "" : value.trim();
    }
}
