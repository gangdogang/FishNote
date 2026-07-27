package com.fishnote.cache;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.cache.Cache;
import org.springframework.cache.support.SimpleCacheManager;

class FishStatsCacheEvictionListenerTest {

    @Test
    void evictsIdAndSlugDetailKeysAndAllStatDependentCatalogData() {
        SimpleCacheManager manager = (SimpleCacheManager) new CacheConfig().cacheManager();
        manager.afterPropertiesSet();
        Cache detail = manager.getCache(CacheNames.FISH_DETAIL);
        Cache catalog = manager.getCache(CacheNames.FISH_CATALOG);
        Cache home = manager.getCache(CacheNames.HOME);
        assertThat(detail).isNotNull();
        assertThat(catalog).isNotNull();
        assertThat(home).isNotNull();
        detail.put("1", "by-id");
        detail.put("gwangeo", "by-slug");
        detail.put("bangeo", "other-fish");
        catalog.put("query", "catalog");
        home.put("7:popular", "home");

        new FishStatsCacheEvictionListener(manager)
                .evictAfterCommit(new FishStatsChangedEvent(1L, "Gwangeo"));

        assertThat(detail.get("1")).isNull();
        assertThat(detail.get("gwangeo")).isNull();
        assertThat(detail.get("bangeo", String.class)).isEqualTo("other-fish");
        assertThat(catalog.get("query")).isNull();
        assertThat(home.get("7:popular")).isNull();
    }
}
