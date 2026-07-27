package com.fishnote.cache;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.cache.support.NoOpCacheManager;

class CacheConfigTest {

    @Test
    void disabledFlagProvidesANoOpCacheManager() {
        assertThat(new CacheConfig(false).cacheManager()).isInstanceOf(NoOpCacheManager.class);
    }
}
