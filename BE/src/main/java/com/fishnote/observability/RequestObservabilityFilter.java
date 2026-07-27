package com.fishnote.observability;

import io.micrometer.core.instrument.DistributionSummary;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Metrics;
import io.micrometer.core.instrument.Timer;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.Locale;
import java.util.Objects;
import java.util.UUID;
import java.util.concurrent.TimeUnit;
import java.util.function.LongSupplier;
import java.util.function.Supplier;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import org.springframework.web.servlet.HandlerMapping;

/**
 * Establishes a request trace and records bounded HTTP/SQL observations.
 *
 * <p>Metric tags use the MVC handler pattern, never the raw URI or query string. Logs contain
 * only the generated trace ID, normalized method/route/status, duration, and statement count.</p>
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 10)
public final class RequestObservabilityFilter extends OncePerRequestFilter {

    public static final String TRACE_ID_ATTRIBUTE = "traceId";
    public static final String TRACE_ID_HEADER = "X-Trace-Id";
    public static final String TRACE_ID_MDC_KEY = "traceId";

    static final String REQUEST_METRIC = "fishnote.http.server.requests";
    static final String REQUEST_SQL_METRIC = "fishnote.http.server.sql.statements";
    static final String UNMATCHED_ROUTE = "unmatched";

    private static final int MAX_ROUTE_TAG_LENGTH = 240;
    private static final Logger log = LoggerFactory.getLogger(RequestObservabilityFilter.class);

    private final MeterRegistry meterRegistry;
    private final Supplier<String> traceIdSupplier;
    private final LongSupplier nanoTime;

    @Autowired
    public RequestObservabilityFilter(ObjectProvider<MeterRegistry> registryProvider) {
        this(
                registryProvider.getIfAvailable(() -> Metrics.globalRegistry),
                () -> UUID.randomUUID().toString(),
                System::nanoTime);
    }

    RequestObservabilityFilter(MeterRegistry meterRegistry) {
        this(meterRegistry, () -> UUID.randomUUID().toString(), System::nanoTime);
    }

    RequestObservabilityFilter(
            MeterRegistry meterRegistry,
            Supplier<String> traceIdSupplier,
            LongSupplier nanoTime) {
        this.meterRegistry = Objects.requireNonNull(meterRegistry);
        this.traceIdSupplier = Objects.requireNonNull(traceIdSupplier);
        this.nanoTime = Objects.requireNonNull(nanoTime);
    }

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain) throws ServletException, IOException {
        String traceId = traceIdSupplier.get();
        String previousTraceId = MDC.get(TRACE_ID_MDC_KEY);
        long startedAt = nanoTime.getAsLong();
        boolean failed = false;

        request.setAttribute(TRACE_ID_ATTRIBUTE, traceId);
        response.setHeader(TRACE_ID_HEADER, traceId);
        MDC.put(TRACE_ID_MDC_KEY, traceId);

        RequestSqlStatementCount.Scope sqlScope = RequestSqlStatementCount.open();
        try {
            filterChain.doFilter(request, response);
        } catch (IOException | ServletException | RuntimeException | Error exception) {
            failed = true;
            throw exception;
        } finally {
            RequestSqlStatementCount.Snapshot sqlObservation = sqlScope.snapshot();
            sqlScope.close();
            long durationNanos = Math.max(0, nanoTime.getAsLong() - startedAt);
            try {
                record(request, response, failed, durationNanos, sqlObservation, traceId);
            } finally {
                restoreMdc(previousTraceId);
            }
        }
    }

    private void record(
            HttpServletRequest request,
            HttpServletResponse response,
            boolean failed,
            long durationNanos,
            RequestSqlStatementCount.Snapshot sqlObservation,
            String traceId) {
        String method = normalizeMethod(request.getMethod());
        String route = normalizedRoute(request);
        int observedStatus = failed && response.getStatus() < 400
                ? HttpServletResponse.SC_INTERNAL_SERVER_ERROR
                : response.getStatus();
        String status = observedStatus >= 100 && observedStatus <= 599
                ? Integer.toString(observedStatus)
                : "other";

        try {
            Timer.builder(REQUEST_METRIC)
                    .description("Server request latency tagged by bounded MVC route metadata")
                    .tags("method", method, "route", route, "status", status)
                    .register(meterRegistry)
                    .record(durationNanos, TimeUnit.NANOSECONDS);

            DistributionSummary.builder(REQUEST_SQL_METRIC)
                    .description("Database statement execution attempts per server request")
                    .baseUnit("statements")
                    .tags("method", method, "route", route, "status", status)
                    .register(meterRegistry)
                    .record(sqlObservation.count());
        } catch (RuntimeException exception) {
            // Metrics are diagnostic only and must not replace a successful API response.
            log.warn(
                    "Request metric recording failed. traceId={}, errorType={}",
                    traceId,
                    exception.getClass().getSimpleName());
        }

        log.info(
                "http_request traceId={} method={} route={} status={} durationMs={} sqlCount={} "
                        + "sqlOperations={} sqlSample={} sqlSampleTruncated={}",
                traceId,
                method,
                route,
                status,
                TimeUnit.NANOSECONDS.toMillis(durationNanos),
                sqlObservation.count(),
                sqlObservation.operationCounts(),
                sqlObservation.samples(),
                sqlObservation.sampleTruncated());
    }

    private String normalizeMethod(String rawMethod) {
        if (rawMethod == null) {
            return "OTHER";
        }
        String method = rawMethod.toUpperCase(Locale.ROOT);
        return switch (method) {
            case "GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS" -> method;
            default -> "OTHER";
        };
    }

    private String normalizedRoute(HttpServletRequest request) {
        Object pattern = request.getAttribute(HandlerMapping.BEST_MATCHING_PATTERN_ATTRIBUTE);
        if (pattern == null) {
            return UNMATCHED_ROUTE;
        }
        String route = pattern.toString();
        if (route.isBlank() || route.length() > MAX_ROUTE_TAG_LENGTH) {
            return UNMATCHED_ROUTE;
        }
        return route;
    }

    private void restoreMdc(String previousTraceId) {
        if (previousTraceId == null) {
            MDC.remove(TRACE_ID_MDC_KEY);
        } else {
            MDC.put(TRACE_ID_MDC_KEY, previousTraceId);
        }
    }
}
