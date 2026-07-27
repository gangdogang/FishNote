package com.fishnote.cache;

import com.fishnote.price.PriceImportAfterCommitHook;
import com.fishnote.price.PriceImportCommittedEvent;
import io.micrometer.core.instrument.MeterRegistry;
import java.util.Set;
import java.util.concurrent.atomic.AtomicLong;
import org.springframework.cache.Cache;
import org.springframework.cache.CacheManager;
import org.springframework.stereotype.Component;

@Component
public class PriceCacheEvictionHook implements PriceImportAfterCommitHook {

    private final CacheManager cacheManager;
    private final MeterRegistry meterRegistry;

    public PriceCacheEvictionHook(CacheManager cacheManager, MeterRegistry meterRegistry) {
        this.cacheManager = cacheManager;
        this.meterRegistry = meterRegistry;
    }

    @Override
    public void afterCommit(PriceImportCommittedEvent event) {
        Set<Long> fishIds = event.fishIds();
        if (fishIds.isEmpty()) {
            return;
        }
        Cache springCache = cacheManager.getCache(CacheNames.FISH_PRICE);
        if (springCache == null) {
            return;
        }
        Object nativeCache = springCache.getNativeCache();
        if (!(nativeCache instanceof com.github.benmanes.caffeine.cache.Cache<?, ?> caffeine)) {
            springCache.clear();
            meterRegistry.counter("fishnote.cache.evictions", "cache", CacheNames.FISH_PRICE)
                    .increment();
            return;
        }

        AtomicLong removed = new AtomicLong();
        caffeine.asMap().keySet().removeIf(key -> {
            boolean matches = key instanceof FishPriceCacheQuery query
                    && fishIds.contains(query.fishId());
            if (matches) {
                removed.incrementAndGet();
            }
            return matches;
        });
        if (removed.get() > 0) {
            meterRegistry.counter("fishnote.cache.evictions", "cache", CacheNames.FISH_PRICE)
                    .increment(removed.get());
        }
    }
}
