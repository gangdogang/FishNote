package com.fishnote.observability;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import java.net.SocketTimeoutException;
import org.junit.jupiter.api.Test;
import org.springframework.web.client.ResourceAccessException;

class ExternalApiMetricsTest {

    @Test
    void recordsSuccessWithoutCapturingRawUrlOrPayloadTags() {
        SimpleMeterRegistry registry = new SimpleMeterRegistry();
        ExternalApiMetrics metrics = new ExternalApiMetrics(registry);

        assertThat(metrics.record("KAKAO", "token", () -> "ok")).isEqualTo("ok");

        assertThat(registry.get(ExternalApiMetrics.DURATION_METRIC)
                        .tags("provider", "kakao", "operation", "token", "outcome", "success")
                        .timer()
                        .count())
                .isEqualTo(1);
    }

    @Test
    void countsTimeoutByBoundedProviderAndOperationOnly() {
        SimpleMeterRegistry registry = new SimpleMeterRegistry();
        ExternalApiMetrics metrics = new ExternalApiMetrics(registry);

        assertThatThrownBy(() -> metrics.record(
                        "telegram",
                        "send_message",
                        () -> {
                            throw new ResourceAccessException(
                                    "redacted by caller",
                                    new SocketTimeoutException("timed out"));
                        }))
                .isInstanceOf(ResourceAccessException.class);

        assertThat(registry.get(ExternalApiMetrics.TIMEOUT_METRIC)
                        .tags("provider", "telegram", "operation", "send_message")
                        .counter()
                        .count())
                .isEqualTo(1);
    }
}
