package com.fishnote.cache;

import java.util.Locale;
import org.springframework.util.StringUtils;

public record FishCatalogCacheQuery(
        String search,
        String season,
        String taste,
        Short priceLevel,
        Short month,
        Boolean featured,
        String category,
        String sort,
        int limit,
        String cursor) {

    public FishCatalogCacheQuery {
        search = normalize(search, true);
        season = normalize(season, true);
        taste = normalize(taste, true);
        category = normalize(category, true);
        sort = normalize(sort, true);
        cursor = normalize(cursor, false);
    }

    private static String normalize(String value, boolean lowerCase) {
        if (!StringUtils.hasText(value)) {
            return null;
        }
        String normalized = value.trim().replaceAll("\\s+", " ");
        return lowerCase ? normalized.toLowerCase(Locale.ROOT) : normalized;
    }
}
