package com.fishnote.fish;

import com.fishnote.cache.FishCatalogCacheQuery;
import com.fishnote.cache.PublicHttpCache;
import com.fishnote.cache.PublicReadCacheService;
import com.fishnote.common.FeatureDisabledException;
import com.fishnote.fish.dto.FishCatalogResponse;
import com.fishnote.fish.dto.FishDetailResponse;
import org.springframework.http.ResponseEntity;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.context.request.WebRequest;

@RestController
@RequestMapping("/api/v2/fish")
public class FishV2Controller {

    private final PublicReadCacheService publicReads;
    private final PublicHttpCache httpCache;
    private final boolean enabled;

    public FishV2Controller(
            PublicReadCacheService publicReads,
            PublicHttpCache httpCache,
            @Value("${app.catalog.v2.enabled:true}") boolean enabled) {
        this.publicReads = publicReads;
        this.httpCache = httpCache;
        this.enabled = enabled;
    }

    @GetMapping
    public ResponseEntity<FishCatalogResponse> list(
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String season,
            @RequestParam(required = false) String taste,
            @RequestParam(required = false) Short priceLevel,
            @RequestParam(required = false) Short month,
            @RequestParam(required = false) Boolean featured,
            @RequestParam(required = false) String category,
            @RequestParam(defaultValue = "popular") String sort,
            @RequestParam(defaultValue = "24") int limit,
            @RequestParam(required = false) String cursor) {
        ensureEnabled();
        FishCatalogResponse body = publicReads.listV2(new FishCatalogCacheQuery(
                search,
                season,
                taste,
                priceLevel,
                month,
                featured,
                category,
                sort,
                limit,
                cursor));
        return httpCache.list(body);
    }

    @GetMapping("/{identifier}")
    public ResponseEntity<FishDetailResponse> detail(
            @PathVariable String identifier,
            WebRequest request) {
        ensureEnabled();
        return httpCache.detail(publicReads.detail(identifier), request);
    }

    private void ensureEnabled() {
        if (!enabled) {
            throw new FeatureDisabledException("도감 v2 조회가 일시적으로 비활성화되었습니다.");
        }
    }
}
