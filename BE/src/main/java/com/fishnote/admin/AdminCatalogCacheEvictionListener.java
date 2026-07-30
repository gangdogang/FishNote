package com.fishnote.admin;

import com.fishnote.cache.CacheNames;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.cache.Cache;
import org.springframework.cache.CacheManager;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

@Component
public class AdminCatalogCacheEvictionListener {

    private static final Logger log = LoggerFactory.getLogger(AdminCatalogCacheEvictionListener.class);

    private final CacheManager cacheManager;

    public AdminCatalogCacheEvictionListener(CacheManager cacheManager) {
        this.cacheManager = cacheManager;
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void clearPublicCatalogCaches(AdminCatalogChangedEvent event) {
        try {
            clear(CacheNames.FISH_CATALOG);
            clear(CacheNames.FISH_DETAIL);
            clear(CacheNames.HOME);
        } catch (RuntimeException exception) {
            // The catalog transaction is already committed; cache cleanup is best-effort.
            log.warn(
                    "Admin catalog cache eviction failed after commit. errorType={}",
                    exception.getClass().getSimpleName());
        }
    }

    private void clear(String cacheName) {
        Cache cache = cacheManager.getCache(cacheName);
        if (cache != null) {
            cache.clear();
        }
    }
}
