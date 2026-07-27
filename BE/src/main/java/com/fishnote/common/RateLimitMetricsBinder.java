package com.fishnote.common;

import io.micrometer.core.instrument.Gauge;
import io.micrometer.core.instrument.MeterRegistry;
import org.springframework.stereotype.Component;

/** Exposes only bounded cache cardinalities; actor keys and counters remain private. */
@Component
public final class RateLimitMetricsBinder {

    static final String TRACKED_ENTRIES_METRIC = "fishnote.rate.limit.tracked.entries";

    public RateLimitMetricsBinder(RateLimitFilter rateLimitFilter, MeterRegistry meterRegistry) {
        Gauge.builder(
                        TRACKED_ENTRIES_METRIC,
                        rateLimitFilter,
                        filter -> filter.trackedActorCount())
                .description("Current number of bounded rate-limit cache entries")
                .tag("scope", "actor")
                .strongReference(true)
                .register(meterRegistry);
        Gauge.builder(
                        TRACKED_ENTRIES_METRIC,
                        rateLimitFilter,
                        filter -> filter.trackedGlobalCount())
                .description("Current number of bounded rate-limit cache entries")
                .tag("scope", "global")
                .strongReference(true)
                .register(meterRegistry);
    }
}
