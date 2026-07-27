package com.fishnote.cache;

import java.util.List;
import java.util.Locale;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.cache.Cache;
import org.springframework.cache.CacheManager;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;
import org.springframework.util.StringUtils;

@Component
public class FishStatsCacheEvictionListener {

    private static final Logger log = LoggerFactory.getLogger(FishStatsCacheEvictionListener.class);

    private final CacheManager cacheManager;

    public FishStatsCacheEvictionListener(CacheManager cacheManager) {
        this.cacheManager = cacheManager;
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void evictAfterCommit(FishStatsChangedEvent event) {
        try {
            Cache detail = cacheManager.getCache(CacheNames.FISH_DETAIL);
            if (detail != null) {
                detail.evict(event.fishId().toString());
                if (StringUtils.hasText(event.fishSlug())) {
                    detail.evict(event.fishSlug().trim().toLowerCase(Locale.ROOT));
                }
            }
            for (String cacheName : List.of(CacheNames.FISH_CATALOG, CacheNames.HOME)) {
                Cache cache = cacheManager.getCache(cacheName);
                if (cache != null) {
                    cache.clear();
                }
            }
        } catch (RuntimeException exception) {
            // The review transaction has already committed; cache cleanup remains best-effort.
            log.warn(
                    "Fish stat cache eviction failed after commit. errorType={}",
                    exception.getClass().getSimpleName());
        }
    }
}
