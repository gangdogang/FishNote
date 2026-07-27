package com.fishnote.home;

import com.fishnote.cache.CacheNames;
import com.fishnote.cache.FishCatalogCacheQuery;
import com.fishnote.cache.PublicReadCacheService;
import com.fishnote.common.FeatureDisabledException;
import com.fishnote.fish.dto.FishCatalogResponse;
import com.fishnote.fish.dto.FishSummaryResponse;
import java.time.Clock;
import java.time.Instant;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

@Service
public class HomeService {

    private static final int CATALOG_FIRST_PAGE_LIMIT = 100;
    private static final Set<String> SORTS = Set.of("popular", "name");

    private final PublicReadCacheService publicReads;
    private final Clock clock;
    private final boolean catalogV2Enabled;

    public HomeService(
            PublicReadCacheService publicReads,
            Clock clock,
            @Value("${app.catalog.v2.enabled:true}") boolean catalogV2Enabled) {
        this.publicReads = publicReads;
        this.clock = clock;
        this.catalogV2Enabled = catalogV2Enabled;
    }

    @Cacheable(
            cacheNames = CacheNames.HOME,
            key = "#month + ':' + (#sort == null ? 'popular' : #sort.trim().toLowerCase())",
            sync = true)
    public HomeResponse getHome(short month, String sort) {
        ensureCatalogEnabled();
        validateMonth(month);
        String normalizedSort = normalizeSort(sort);
        FishCatalogResponse catalogPage = publicReads.listV2(new FishCatalogCacheQuery(
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                normalizedSort,
                CATALOG_FIRST_PAGE_LIMIT,
                null));
        List<FishSummaryResponse> catalog = List.copyOf(catalogPage.items());
        List<FishSummaryResponse> seasonal = catalog.stream()
                .filter(fish -> fish.seasonMonths().contains(month))
                .toList();
        List<FishSummaryResponse> featured = catalog.stream()
                .filter(FishSummaryResponse::featured)
                .toList();
        return new HomeResponse(
                month,
                Instant.now(clock),
                seasonal,
                featured,
                catalog,
                catalogPage.facets());
    }

    private void ensureCatalogEnabled() {
        if (!catalogV2Enabled) {
            throw new FeatureDisabledException("도감 v2 조회가 일시적으로 비활성화되었습니다.");
        }
    }

    private void validateMonth(short month) {
        if (month < 1 || month > 12) {
            throw new IllegalArgumentException("month는 1~12 사이여야 합니다.");
        }
    }

    private String normalizeSort(String sort) {
        String normalized = StringUtils.hasText(sort)
                ? sort.trim().toLowerCase(Locale.ROOT)
                : "popular";
        if (!SORTS.contains(normalized)) {
            throw new IllegalArgumentException("sort는 popular 또는 name 중 하나여야 합니다.");
        }
        return normalized;
    }
}
