package com.fishnote.fish.query;

import com.fishnote.fish.FishCategory;
import java.util.Set;

public record FishCatalogQuery(
        String search,
        Set<Short> seasonMonths,
        String taste,
        Short priceLevel,
        Short month,
        Boolean featured,
        FishCategory category,
        String sort,
        int limit,
        FishCatalogCursor cursor
) {
}
