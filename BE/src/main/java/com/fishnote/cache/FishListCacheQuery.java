package com.fishnote.cache;

import java.util.Locale;
import org.springframework.util.StringUtils;

public record FishListCacheQuery(
        String search,
        String season,
        String taste,
        Short priceLevel,
        Short month,
        Boolean featured,
        String sort) {

    public FishListCacheQuery {
        search = normalize(search);
        season = normalize(season);
        taste = normalize(taste);
        sort = normalize(sort);
    }

    private static String normalize(String value) {
        if (!StringUtils.hasText(value)) {
            return null;
        }
        return value.trim().replaceAll("\\s+", " ").toLowerCase(Locale.ROOT);
    }
}
