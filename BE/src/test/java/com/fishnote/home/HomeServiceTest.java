package com.fishnote.home;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.fishnote.cache.FishCatalogCacheQuery;
import com.fishnote.cache.PublicReadCacheService;
import com.fishnote.common.FeatureDisabledException;
import com.fishnote.common.dto.CursorPageInfoResponse;
import com.fishnote.fish.FishCategory;
import com.fishnote.fish.dto.FishCatalogResponse;
import com.fishnote.fish.dto.FishFacetsResponse;
import com.fishnote.fish.dto.FishSummaryResponse;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

class HomeServiceTest {

    private static final Instant NOW = Instant.parse("2026-07-22T00:00:00Z");

    @Test
    void derivesThreeSectionsAndFacetsFromOneCatalogRead() {
        PublicReadCacheService publicReads = mock(PublicReadCacheService.class);
        FishFacetsResponse facets = new FishFacetsResponse(
                Map.of("담백", 2L),
                Map.of("summer", 2L),
                Map.of("2", 2L),
                Map.of("FISH", 3L));
        FishSummaryResponse seasonalFeatured = fish(1L, "광어", true, List.of((short) 7));
        FishSummaryResponse seasonal = fish(2L, "민어", false, List.of((short) 7, (short) 8));
        FishSummaryResponse featured = fish(3L, "연어", true, List.of((short) 1));
        when(publicReads.listV2(org.mockito.ArgumentMatchers.any())).thenReturn(new FishCatalogResponse(
                List.of(seasonalFeatured, seasonal, featured),
                new CursorPageInfoResponse(null, false, 100),
                facets));

        HomeService service = new HomeService(publicReads, Clock.fixed(NOW, ZoneOffset.UTC), true);

        HomeResponse response = service.getHome((short) 7, "popular");

        assertThat(response.month()).isEqualTo((short) 7);
        assertThat(response.generatedAt()).isEqualTo(NOW);
        assertThat(response.seasonal()).containsExactly(seasonalFeatured, seasonal);
        assertThat(response.featured()).containsExactly(seasonalFeatured, featured);
        assertThat(response.catalog()).containsExactly(seasonalFeatured, seasonal, featured);
        assertThat(response.facets()).isSameAs(facets);

        ArgumentCaptor<FishCatalogCacheQuery> query = ArgumentCaptor.forClass(FishCatalogCacheQuery.class);
        verify(publicReads).listV2(query.capture());
        assertThat(query.getValue().limit()).isEqualTo(100);
        assertThat(query.getValue().sort()).isEqualTo("popular");
        assertThat(query.getValue().cursor()).isNull();
    }

    @Test
    void rejectsInvalidMonthAndSortBeforeReadingCatalog() {
        PublicReadCacheService publicReads = mock(PublicReadCacheService.class);
        HomeService service = new HomeService(publicReads, Clock.fixed(NOW, ZoneOffset.UTC), true);

        assertThatThrownBy(() -> service.getHome((short) 0, "popular"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("1~12");
        assertThatThrownBy(() -> service.getHome((short) 7, "newest"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("popular");
        org.mockito.Mockito.verifyNoInteractions(publicReads);
    }

    @Test
    void disabledCatalogFlagBlocksHomeBeforeReadingV2Catalog() {
        PublicReadCacheService publicReads = mock(PublicReadCacheService.class);
        HomeService service = new HomeService(publicReads, Clock.fixed(NOW, ZoneOffset.UTC), false);

        assertThatThrownBy(() -> service.getHome((short) 7, "popular"))
                .isInstanceOf(FeatureDisabledException.class);

        verifyNoInteractions(publicReads);
    }

    private FishSummaryResponse fish(Long id, String name, boolean featured, List<Short> months) {
        return new FishSummaryResponse(
                id,
                "fish-" + id,
                FishCategory.FISH,
                name,
                null,
                null,
                name + " 설명",
                (short) 2,
                List.of("담백"),
                months,
                featured,
                4.5,
                10,
                10);
    }
}
