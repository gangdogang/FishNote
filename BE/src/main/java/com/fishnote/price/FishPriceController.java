package com.fishnote.price;

import com.fishnote.cache.FishPriceCacheQuery;
import com.fishnote.cache.PublicHttpCache;
import com.fishnote.cache.PublicReadCacheService;
import com.fishnote.price.dto.FishPriceSummaryResponse;
import jakarta.validation.constraints.Size;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/fish/{fishId}/prices")
@Validated
public class FishPriceController {

    private final PublicReadCacheService publicReads;
    private final PublicHttpCache httpCache;

    public FishPriceController(PublicReadCacheService publicReads, PublicHttpCache httpCache) {
        this.publicReads = publicReads;
        this.httpCache = httpCache;
    }

    @GetMapping
    public ResponseEntity<FishPriceSummaryResponse> recentPrices(
            @PathVariable Long fishId,
            @RequestParam(required = false) Integer days,
            @RequestParam(defaultValue = "DAY") PriceResolution resolution,
            @RequestParam(required = false) Integer maxPoints,
            @RequestParam(required = false) @Size(max = 300) String variantKey) {
        FishPriceSummaryResponse body = publicReads.price(
                new FishPriceCacheQuery(fishId, days, resolution, maxPoints, variantKey));
        return httpCache.price(body);
    }
}
