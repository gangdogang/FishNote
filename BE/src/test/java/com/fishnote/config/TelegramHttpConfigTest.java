package com.fishnote.config;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Duration;
import org.junit.jupiter.api.Test;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.test.util.ReflectionTestUtils;

class TelegramHttpConfigTest {

    private final TelegramHttpConfig config = new TelegramHttpConfig();

    @Test
    void appliesTwoSecondConnectAndThreeSecondReadTimeouts() {
        var restTemplate = config.telegramRestTemplate(
                Duration.ofSeconds(2), Duration.ofSeconds(3));
        var requestFactory = (SimpleClientHttpRequestFactory) restTemplate.getRequestFactory();

        assertThat(ReflectionTestUtils.getField(requestFactory, "connectTimeout"))
                .isEqualTo(2_000);
        assertThat(ReflectionTestUtils.getField(requestFactory, "readTimeout"))
                .isEqualTo(3_000);
    }

    @Test
    void rejectsMissingOrUnboundedTimeouts() {
        assertThatThrownBy(() -> config.telegramRestTemplate(
                        Duration.ZERO, Duration.ofSeconds(3)))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> config.telegramRestTemplate(
                        Duration.ofNanos(1), Duration.ofSeconds(3)))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> config.telegramRestTemplate(
                        Duration.ofSeconds(2), Duration.ofNanos(1)))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> config.telegramRestTemplate(
                        Duration.ofSeconds(2), Duration.ofSeconds(31)))
                .isInstanceOf(IllegalArgumentException.class);
    }
}
