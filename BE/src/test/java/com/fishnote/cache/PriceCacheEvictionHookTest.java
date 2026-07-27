package com.fishnote.cache;

import static org.assertj.core.api.Assertions.assertThat;

import com.fishnote.price.PriceImportCommittedEvent;
import com.fishnote.price.PriceResolution;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.springframework.cache.Cache;
import org.springframework.cache.CacheManager;
import org.springframework.cache.support.SimpleCacheManager;

class PriceCacheEvictionHookTest {

    @Test
    void evictsOnlyQueriesForFishIdsCommittedByTheImport() {
        CacheManager manager = new CacheConfig().cacheManager();
        ((SimpleCacheManager) manager).afterPropertiesSet();
        Cache cache = manager.getCache(CacheNames.FISH_PRICE);
        assertThat(cache).isNotNull();
        FishPriceCacheQuery fish1Daily = new FishPriceCacheQuery(1L, 14, PriceResolution.DAY, 30, null);
        FishPriceCacheQuery fish1Weekly = new FishPriceCacheQuery(1L, 30, PriceResolution.WEEK, 10, null);
        FishPriceCacheQuery fish2 = new FishPriceCacheQuery(2L, 14, PriceResolution.DAY, 30, null);
        cache.put(fish1Daily, "one-daily");
        cache.put(fish1Weekly, "one-weekly");
        cache.put(fish2, "two");

        SimpleMeterRegistry meters = new SimpleMeterRegistry();
        PriceCacheEvictionHook hook = new PriceCacheEvictionHook(manager, meters);
        hook.afterCommit(new PriceImportCommittedEvent(Set.of(1L), null));

        assertThat(cache.get(fish1Daily)).isNull();
        assertThat(cache.get(fish1Weekly)).isNull();
        assertThat(cache.get(fish2, String.class)).isEqualTo("two");
        assertThat(meters.counter("fishnote.cache.evictions", "cache", CacheNames.FISH_PRICE).count())
                .isEqualTo(2.0);
    }
}
