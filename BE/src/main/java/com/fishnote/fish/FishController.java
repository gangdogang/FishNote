package com.fishnote.fish;

import com.fishnote.cache.FishListCacheQuery;
import com.fishnote.cache.PublicHttpCache;
import com.fishnote.cache.PublicReadCacheService;
import com.fishnote.fish.dto.FishAliasManifestResponse;
import com.fishnote.fish.dto.FishDetailResponse;
import com.fishnote.fish.dto.FishSummaryResponse;
import com.fishnote.fish.dto.FishSuggestionsResponse;
import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.context.request.WebRequest;

@RestController
@RequestMapping("/api/v1/fish")
public class FishController {

    private final FishService fishService;
    private final PublicReadCacheService publicReads;
    private final PublicHttpCache httpCache;

    public FishController(
            FishService fishService,
            PublicReadCacheService publicReads,
            PublicHttpCache httpCache) {
        this.fishService = fishService;
        this.publicReads = publicReads;
        this.httpCache = httpCache;
    }

    @GetMapping
    public ResponseEntity<List<FishSummaryResponse>> list(
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String season,
            @RequestParam(required = false) String taste,
            @RequestParam(required = false) Short priceLevel,
            @RequestParam(required = false) Short month,
            @RequestParam(required = false) Boolean featured,
            @RequestParam(defaultValue = "popular") String sort) {
        List<FishSummaryResponse> body = publicReads.listV1(
                new FishListCacheQuery(search, season, taste, priceLevel, month, featured, sort));
        return httpCache.list(body);
    }

    @GetMapping("/suggestions")
    public FishSuggestionsResponse suggestions(
            @RequestParam String q,
            @RequestParam(defaultValue = "8") int limit) {
        return fishService.suggestFishes(q, limit);
    }

    @GetMapping("/aliases/price-parser")
    public FishAliasManifestResponse priceAliasManifest() {
        return fishService.getPriceAliasManifest();
    }

    @GetMapping("/{identifier}")
    public ResponseEntity<FishDetailResponse> detail(
            @PathVariable String identifier,
            WebRequest request) {
        return httpCache.detail(publicReads.detail(identifier), request);
    }
}
