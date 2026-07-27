package com.fishnote.common;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import org.junit.jupiter.api.Test;

class RateLimitMetricsBinderTest {

    @Test
    void exposesOnlyBoundedCacheSizesWithFixedScopeTags() {
        RateLimitFilter filter = mock(RateLimitFilter.class);
        when(filter.trackedActorCount()).thenReturn(123L);
        when(filter.trackedGlobalCount()).thenReturn(4L);
        SimpleMeterRegistry registry = new SimpleMeterRegistry();

        new RateLimitMetricsBinder(filter, registry);

        assertThat(registry.get(RateLimitMetricsBinder.TRACKED_ENTRIES_METRIC)
                        .tag("scope", "actor")
                        .gauge()
                        .value())
                .isEqualTo(123.0);
        assertThat(registry.get(RateLimitMetricsBinder.TRACKED_ENTRIES_METRIC)
                        .tag("scope", "global")
                        .gauge()
                        .value())
                .isEqualTo(4.0);
        assertThat(registry.find(RateLimitMetricsBinder.TRACKED_ENTRIES_METRIC).gauges())
                .hasSize(2);
    }
}
