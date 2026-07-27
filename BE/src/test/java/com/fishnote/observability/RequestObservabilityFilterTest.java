package com.fishnote.observability;

import static org.assertj.core.api.Assertions.assertThat;

import io.micrometer.core.instrument.DistributionSummary;
import io.micrometer.core.instrument.Timer;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import java.util.concurrent.atomic.AtomicLong;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.slf4j.MDC;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.web.servlet.HandlerMapping;

class RequestObservabilityFilterTest {

    @AfterEach
    void clearMdc() {
        MDC.clear();
    }

    @Test
    void addsGeneratedTraceAndRecordsOnlyNormalizedRouteMetadata() throws Exception {
        SimpleMeterRegistry registry = new SimpleMeterRegistry();
        AtomicLong clock = new AtomicLong(1_000_000);
        RequestObservabilityFilter filter = new RequestObservabilityFilter(
                registry,
                () -> "generated-trace-id",
                () -> clock.getAndAdd(2_000_000));
        HibernateSqlObservationInspector inspector = new HibernateSqlObservationInspector(registry);
        JdbcTemplate jdbc = new JdbcTemplate(new SqlObservingDataSource(new DriverManagerDataSource(
                "jdbc:h2:mem:request_observation;DB_CLOSE_DELAY=-1", "sa", "")));
        MockHttpServletRequest request = new MockHttpServletRequest(
                "GET", "/api/v1/fish/987654321");
        request.setQueryString("access_token=must-not-be-observed");
        MockHttpServletResponse response = new MockHttpServletResponse();
        MDC.put(RequestObservabilityFilter.TRACE_ID_MDC_KEY, "outer-trace");

        filter.doFilter(request, response, (servletRequest, servletResponse) -> {
            assertThat(MDC.get(RequestObservabilityFilter.TRACE_ID_MDC_KEY))
                    .isEqualTo("generated-trace-id");
            servletRequest.setAttribute(
                    HandlerMapping.BEST_MATCHING_PATTERN_ATTRIBUTE,
                    "/api/v1/fish/{fishId}");
            jdbc.queryForObject(inspector.inspect("select 1"), Integer.class);
            jdbc.queryForObject("select 987654321", Integer.class);
            ((MockHttpServletResponse) servletResponse).setStatus(201);
        });

        assertThat(response.getHeader(RequestObservabilityFilter.TRACE_ID_HEADER))
                .isEqualTo("generated-trace-id");
        assertThat(request.getAttribute(RequestObservabilityFilter.TRACE_ID_ATTRIBUTE))
                .isEqualTo("generated-trace-id");
        assertThat(MDC.get(RequestObservabilityFilter.TRACE_ID_MDC_KEY)).isEqualTo("outer-trace");

        Timer requestTimer = registry.get(RequestObservabilityFilter.REQUEST_METRIC)
                .tags("method", "GET", "route", "/api/v1/fish/{fishId}", "status", "201")
                .timer();
        DistributionSummary sqlSummary = registry.get(RequestObservabilityFilter.REQUEST_SQL_METRIC)
                .tags("method", "GET", "route", "/api/v1/fish/{fishId}", "status", "201")
                .summary();
        assertThat(requestTimer.count()).isEqualTo(1);
        assertThat(requestTimer.totalTime(java.util.concurrent.TimeUnit.MILLISECONDS))
                .isEqualTo(2.0);
        assertThat(sqlSummary.count()).isEqualTo(1);
        assertThat(sqlSummary.totalAmount()).isEqualTo(2.0);
        assertThat(registry.getMeters())
                .flatExtracting(meter -> meter.getId().getTags())
                .noneMatch(tag -> tag.getValue().contains("987654321")
                        || tag.getValue().contains("must-not-be-observed")
                        || tag.getValue().contains("sensitive"));
    }

    @Test
    void unmatchedRequestsNeverFallBackToTheRawUri() throws Exception {
        SimpleMeterRegistry registry = new SimpleMeterRegistry();
        RequestObservabilityFilter filter = new RequestObservabilityFilter(registry);
        MockHttpServletRequest request = new MockHttpServletRequest(
                "CUSTOM", "/private/users/42/tokens/secret");
        MockHttpServletResponse response = new MockHttpServletResponse();
        response.setStatus(401);

        filter.doFilter(request, response, (servletRequest, servletResponse) -> {
        });

        assertThat(registry.get(RequestObservabilityFilter.REQUEST_METRIC)
                        .tags("method", "OTHER", "route", "unmatched", "status", "401")
                        .timer()
                        .count())
                .isEqualTo(1);
        assertThat(registry.getMeters())
                .flatExtracting(meter -> meter.getId().getTags())
                .noneMatch(tag -> tag.getValue().contains("secret")
                        || tag.getValue().contains("users/42"));
    }
}
