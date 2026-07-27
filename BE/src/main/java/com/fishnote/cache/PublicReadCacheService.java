package com.fishnote.cache;

import com.fishnote.fish.FishService;
import com.fishnote.fish.FishV2Service;
import com.fishnote.fish.dto.FishCatalogResponse;
import com.fishnote.fish.dto.FishDetailResponse;
import com.fishnote.fish.dto.FishSummaryResponse;
import com.fishnote.price.FishPriceQueryService;
import com.fishnote.price.PriceResolution;
import com.fishnote.price.dto.FishPriceSummaryResponse;
import java.util.List;
import java.util.Locale;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;

@Service
public class PublicReadCacheService {

    private final FishService fishService;
    private final FishV2Service fishV2Service;
    private final FishPriceQueryService priceQueryService;

    public PublicReadCacheService(
            FishService fishService,
            FishV2Service fishV2Service,
            FishPriceQueryService priceQueryService) {
        this.fishService = fishService;
        this.fishV2Service = fishV2Service;
        this.priceQueryService = priceQueryService;
    }

    @Cacheable(cacheNames = CacheNames.FISH_CATALOG, key = "#query", sync = true)
    public List<FishSummaryResponse> listV1(FishListCacheQuery query) {
        return fishService.findFishes(
                query.search(),
                query.season(),
                query.taste(),
                query.priceLevel(),
                query.month(),
                query.featured(),
                defaultSort(query.sort()));
    }

    @Cacheable(cacheNames = CacheNames.FISH_CATALOG, key = "#query", sync = true)
    public FishCatalogResponse listV2(FishCatalogCacheQuery query) {
        return fishV2Service.findFishes(
                query.search(),
                query.season(),
                query.taste(),
                query.priceLevel(),
                query.month(),
                query.featured(),
                query.category(),
                defaultSort(query.sort()),
                query.limit(),
                query.cursor());
    }

    @Cacheable(cacheNames = CacheNames.FISH_DETAIL, key = "#identifier.trim().toLowerCase()", sync = true)
    public FishDetailResponse detail(String identifier) {
        return fishService.getFish(identifier);
    }

    @Cacheable(cacheNames = CacheNames.FISH_PRICE, key = "#query", sync = true)
    public FishPriceSummaryResponse price(FishPriceCacheQuery query) {
        PriceResolution resolution = query.resolution() == null ? PriceResolution.DAY : query.resolution();
        return priceQueryService.getRecentPrices(
                query.fishId(),
                query.days(),
                resolution,
                query.maxPoints(),
                query.variantKey());
    }

    private String defaultSort(String sort) {
        return sort == null ? "popular" : sort.toLowerCase(Locale.ROOT);
    }
}
