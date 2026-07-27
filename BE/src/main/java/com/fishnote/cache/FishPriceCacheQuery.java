package com.fishnote.cache;

import com.fishnote.price.PriceResolution;
import org.springframework.util.StringUtils;

public record FishPriceCacheQuery(
        Long fishId,
        Integer days,
        PriceResolution resolution,
        Integer maxPoints,
        String variantKey) {

    public FishPriceCacheQuery {
        variantKey = StringUtils.hasText(variantKey) ? variantKey.trim() : null;
    }
}
