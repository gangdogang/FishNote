package com.fishnote.common;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.github.benmanes.caffeine.cache.Ticker;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.concurrent.atomic.AtomicLong;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

class RateLimitFilterTest {

    private static final Duration WINDOW = Duration.ofMinutes(10);
    private static final Clock CLOCK = Clock.fixed(
            Instant.parse("2026-07-22T00:00:05Z"),
            ZoneOffset.UTC);

    private final ObjectMapper objectMapper = new ObjectMapper()
            .registerModule(new JavaTimeModule())
            .disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);
    private final MutableTicker ticker = new MutableTicker();

    @AfterEach
    void clearSecurityContext() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void reviewWritesBeyondActorLimitReturnStable429Metadata() throws Exception {
        RateLimitFilter filter = filter(true, 10_000, 100, new ClientIpResolver(""));

        for (int index = 0; index < 10; index++) {
            assertThat(fire(filter, "POST", "/api/v1/fish/1/reviews", "198.51.100.4", null)
                    .getStatus()).isEqualTo(200);
        }

        MockHttpServletResponse blocked = fire(
                filter,
                "POST",
                "/api/v1/fish/1/reviews",
                "198.51.100.4",
                null);
        assertThat(blocked.getStatus()).isEqualTo(429);
        assertThat(blocked.getHeader("Retry-After")).isEqualTo("595");
        assertThat(blocked.getHeader(RateLimitFilter.RESET_HEADER))
                .isEqualTo(Long.toString(Instant.parse("2026-07-22T00:10:00Z").getEpochSecond()));

        JsonNode body = objectMapper.readTree(blocked.getContentAsByteArray());
        assertThat(body.path("code").asText()).isEqualTo("RATE_LIMITED");
        assertThat(body.path("fieldErrors").isObject()).isTrue();
        assertThat(body.path("fieldErrors").isEmpty()).isTrue();
        assertThat(body.path("resetAt").asText()).isEqualTo("2026-07-22T00:10:00Z");
        assertThat(body.path("message").asText()).contains("요청이 너무 많습니다");
    }

    @Test
    void correctionWritesUseTheFiveRequestActorLimit() throws Exception {
        RateLimitFilter filter = filter(true, 10_000, 100, new ClientIpResolver(""));

        for (int index = 0; index < 5; index++) {
            assertThat(fire(
                    filter,
                    "POST",
                    "/api/v1/fish/1/corrections",
                    "198.51.100.44",
                    null).getStatus()).isEqualTo(200);
        }

        MockHttpServletResponse blocked = fire(
                filter,
                "POST",
                "/api/v1/fish/1/corrections",
                "198.51.100.44",
                null);
        assertThat(blocked.getStatus()).isEqualTo(429);
        assertThat(blocked.getHeader("Retry-After")).isEqualTo("595");
        assertThat(blocked.getHeader(RateLimitFilter.RESET_HEADER)).isNotBlank();
        assertThat(objectMapper.readTree(blocked.getContentAsByteArray()).path("code").asText())
                .isEqualTo(RateLimitFilter.ERROR_CODE);
    }

    @Test
    void correctionGlobalBudgetIsBoundedIndependentlyFromActorBuckets() throws Exception {
        RateLimitFilter filter = new RateLimitFilter(
                true,
                objectMapper,
                new ClientIpResolver(""),
                WINDOW,
                10_000,
                100,
                Integer.MAX_VALUE,
                3,
                CLOCK,
                ticker);

        for (int index = 0; index < 3; index++) {
            assertThat(fire(
                    filter,
                    "POST",
                    "/api/v1/fish/1/corrections",
                    "198.51.100." + index,
                    null).getStatus()).isEqualTo(200);
        }
        assertThat(fire(
                filter,
                "POST",
                "/api/v1/fish/1/corrections",
                "203.0.113.1",
                null).getStatus()).isEqualTo(429);
        assertThat(filter.trackedGlobalCount()).isEqualTo(1);
    }

    @Test
    void forgedForwardedHeadersCannotCreateNewBuckets() throws Exception {
        RateLimitFilter filter = filter(true, 10_000, 100, new ClientIpResolver("10.0.0.0/8"));

        for (int index = 0; index < 10; index++) {
            MockHttpServletResponse allowed = fire(
                    filter,
                    "POST",
                    "/api/v1/fish/1/reviews",
                    "198.51.100.7",
                    "203.0.113." + index);
            assertThat(allowed.getStatus()).isEqualTo(200);
        }

        assertThat(fire(
                filter,
                "POST",
                "/api/v1/fish/1/reviews",
                "198.51.100.7",
                "192.0.2.250").getStatus()).isEqualTo(429);
    }

    @Test
    void authenticatedRequestsUseTheUserBucketAcrossIpChanges() throws Exception {
        RateLimitFilter filter = filter(true, 10_000, 100, new ClientIpResolver(""));
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(42L, null, List.of()));

        for (int index = 0; index < 10; index++) {
            assertThat(fire(
                    filter,
                    "POST",
                    "/api/v1/fish/1/reviews",
                    "198.51.100." + index,
                    null).getStatus()).isEqualTo(200);
        }
        assertThat(fire(
                filter,
                "POST",
                "/api/v1/fish/1/reviews",
                "203.0.113.99",
                null).getStatus()).isEqualTo(429);
    }

    @Test
    void endpointGlobalLimitIsIndependentFromActorLimits() throws Exception {
        RateLimitFilter filter = filter(true, 10_000, 2, new ClientIpResolver(""));

        for (int index = 0; index < 30; index++) {
            fire(
                    filter,
                    "POST",
                    "/api/v1/fish/1/reviews",
                    "198.51.100.250",
                    null);
        }

        for (int index = 0; index < 10; index++) {
            assertThat(fire(
                    filter,
                    "POST",
                    "/api/v1/fish/1/reviews",
                    "198.51.100." + index,
                    null).getStatus()).isEqualTo(200);
        }
        assertThat(fire(
                filter,
                "POST",
                "/api/v1/fish/1/reviews",
                "203.0.113.1",
                null).getStatus()).isEqualTo(429);
        assertThat(filter.trackedGlobalCount()).isEqualTo(1);
    }

    @Test
    void manipulatedActorCardinalityRemainsBoundedAndEntriesExpire() throws Exception {
        RateLimitFilter filter = filter(true, 128, 1_000_000, new ClientIpResolver(""));

        for (int index = 0; index < 10_000; index++) {
            String address = "198.18." + ((index / 256) % 256) + '.' + (index % 256);
            fire(filter, "POST", "/api/v1/images", address, null);
        }

        assertThat(filter.trackedActorCount()).isLessThanOrEqualTo(128);
        assertThat(filter.trackedGlobalCount()).isEqualTo(1);

        ticker.advance(WINDOW.plusSeconds(2));
        assertThat(filter.trackedActorCount()).isZero();
        assertThat(filter.trackedGlobalCount()).isZero();
    }

    @Test
    void imageGlobalBudgetCannotOutrunTheCleanupBatch() throws Exception {
        RateLimitFilter filter = new RateLimitFilter(
                true,
                objectMapper,
                new ClientIpResolver(""),
                WINDOW,
                10_000,
                100,
                3,
                CLOCK,
                ticker);

        for (int index = 0; index < 3; index++) {
            assertThat(fire(
                    filter,
                    "POST",
                    "/api/v1/images",
                    "198.51.100." + index,
                    null).getStatus()).isEqualTo(200);
        }
        assertThat(fire(
                filter,
                "POST",
                "/api/v1/images",
                "203.0.113.1",
                null).getStatus()).isEqualTo(429);
    }

    @Test
    void unmatchedEndpointsAndDisabledFilterAreNotLimited() throws Exception {
        RateLimitFilter enabled = filter(true, 10_000, 100, new ClientIpResolver(""));
        RateLimitFilter disabled = filter(false, 10_000, 100, new ClientIpResolver(""));

        for (int index = 0; index < 50; index++) {
            assertThat(fire(enabled, "GET", "/api/v1/fish", "198.51.100.4", null).getStatus())
                    .isEqualTo(200);
            assertThat(fire(disabled, "POST", "/api/v1/fish/1/reviews", "198.51.100.4", null)
                    .getStatus()).isEqualTo(200);
        }
    }

    private RateLimitFilter filter(
            boolean enabled,
            long maximumActors,
            int globalMultiplier,
            ClientIpResolver resolver) {
        return new RateLimitFilter(
                enabled,
                objectMapper,
                resolver,
                WINDOW,
                maximumActors,
                globalMultiplier,
                CLOCK,
                ticker);
    }

    private MockHttpServletResponse fire(
            RateLimitFilter filter,
            String method,
            String uri,
            String remoteAddress,
            String forwardedFor) throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest(method, uri);
        request.setRemoteAddr(remoteAddress);
        if (forwardedFor != null) {
            request.addHeader("X-Forwarded-For", forwardedFor);
        }
        MockHttpServletResponse response = new MockHttpServletResponse();
        filter.doFilter(request, response, new MockFilterChain());
        return response;
    }

    private static final class MutableTicker implements Ticker {
        private final AtomicLong nanos = new AtomicLong();

        @Override
        public long read() {
            return nanos.get();
        }

        void advance(Duration duration) {
            nanos.addAndGet(duration.toNanos());
        }
    }
}
