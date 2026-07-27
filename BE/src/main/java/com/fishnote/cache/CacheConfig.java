package com.fishnote.cache;

import com.github.benmanes.caffeine.cache.Caffeine;
import java.time.Clock;
import java.time.Duration;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.cache.Cache;
import org.springframework.cache.CacheManager;
import org.springframework.cache.caffeine.CaffeineCache;
import org.springframework.cache.annotation.CachingConfigurer;
import org.springframework.cache.interceptor.CacheErrorHandler;
import org.springframework.cache.interceptor.SimpleCacheErrorHandler;
import org.springframework.cache.support.SimpleCacheManager;
import org.springframework.cache.support.NoOpCacheManager;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class CacheConfig implements CachingConfigurer {

    private static final Logger log = LoggerFactory.getLogger(CacheConfig.class);
    private final boolean enabled;

    @Autowired
    public CacheConfig(@Value("${app.cache.public.enabled:true}") boolean enabled) {
        this.enabled = enabled;
    }

    CacheConfig() {
        this(true);
    }

    @Bean
    public Clock applicationClock() {
        return Clock.systemUTC();
    }

    @Bean
    @Override
    public CacheManager cacheManager() {
        if (!enabled) {
            return new NoOpCacheManager();
        }
        SimpleCacheManager manager = new SimpleCacheManager();
        manager.setCaches(List.of(
                caffeine(CacheNames.FISH_CATALOG, Duration.ofMinutes(30), 512),
                caffeine(CacheNames.FISH_DETAIL, Duration.ofMinutes(5), 256),
                caffeine(CacheNames.FISH_PRICE, Duration.ofMinutes(5), 1_024),
                caffeine(CacheNames.HOME, Duration.ofMinutes(1), 64)));
        return manager;
    }

    /**
     * Public reads must continue against PostgreSQL when the local cache misbehaves.
     * Cache keys and values are deliberately omitted from logs.
     */
    @Bean
    @Override
    public CacheErrorHandler errorHandler() {
        return new SimpleCacheErrorHandler() {
            @Override
            public void handleCacheGetError(RuntimeException exception, Cache cache, Object key) {
                warn("get", exception, cache);
            }

            @Override
            public void handleCachePutError(RuntimeException exception, Cache cache, Object key, Object value) {
                warn("put", exception, cache);
            }

            @Override
            public void handleCacheEvictError(RuntimeException exception, Cache cache, Object key) {
                warn("evict", exception, cache);
            }

            @Override
            public void handleCacheClearError(RuntimeException exception, Cache cache) {
                warn("clear", exception, cache);
            }

            private void warn(String operation, RuntimeException exception, Cache cache) {
                log.warn(
                        "Local cache operation failed; falling back to the database. operation={}, cache={}, errorType={}",
                        operation,
                        cache.getName(),
                        exception.getClass().getSimpleName());
            }
        };
    }

    private CaffeineCache caffeine(String name, Duration ttl, long maximumSize) {
        return new CaffeineCache(
                name,
                Caffeine.newBuilder()
                        .maximumSize(maximumSize)
                        .expireAfterWrite(ttl)
                        .recordStats()
                        .build());
    }
}
