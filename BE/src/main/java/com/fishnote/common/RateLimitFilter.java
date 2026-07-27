package com.fishnote.common;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import com.github.benmanes.caffeine.cache.Ticker;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.regex.Pattern;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Bounded fixed-window protection for public write and authentication endpoints.
 *
 * <p>Per-user/IP counters and endpoint-global counters are stored separately so actor-key
 * churn cannot evict the global protection. This remains a single-instance limiter; a future
 * multi-instance deployment must move the counter store to Redis/Bucket4j.</p>
 */
@Component
public class RateLimitFilter extends OncePerRequestFilter {

    private static final Logger log = LoggerFactory.getLogger(RateLimitFilter.class);
    static final String ERROR_CODE = "RATE_LIMITED";
    public static final String RESET_HEADER = "X-RateLimit-Reset";

    private record Rule(String method, Pattern path, int actorLimit, String bucket) {
    }

    private static final List<Rule> RULES = List.of(
            new Rule("POST", Pattern.compile("/api/v1/fish/[^/]+/reviews"), 10, "review-write"),
            new Rule("POST", Pattern.compile("/api/v1/fish/[^/]+/corrections"), 5, "correction-write"),
            new Rule("DELETE", Pattern.compile("/api/v1/reviews/[^/]+"), 10, "review-delete"),
            new Rule("POST", Pattern.compile("/api/v1/reviews/[^/]+/helpful"), 60, "helpful"),
            new Rule("POST", Pattern.compile("/api/v1/images"), 20, "image-upload"),
            new Rule("POST", Pattern.compile("/api/v1/auth/(login|signup|kakao)"), 20, "auth"));

    private final boolean enabled;
    private final ObjectMapper objectMapper;
    private final ClientIpResolver clientIpResolver;
    private final Duration window;
    private final int globalMultiplier;
    private final int imageGlobalLimit;
    private final int correctionGlobalLimit;
    private final Clock clock;
    private final Cache<String, AtomicInteger> actorCounters;
    private final Cache<String, AtomicInteger> globalCounters;

    @Autowired
    public RateLimitFilter(
            @Value("${app.rate-limit.enabled:true}") boolean enabled,
            @Value("${app.rate-limit.window-seconds:600}") long windowSeconds,
            @Value("${app.rate-limit.max-tracked-actors:10000}") long maxTrackedActors,
            @Value("${app.rate-limit.global-multiplier:100}") int globalMultiplier,
            @Value("${app.rate-limit.image-global-limit:40}") int imageGlobalLimit,
            @Value("${app.rate-limit.correction-global-limit:100}") int correctionGlobalLimit,
            ObjectMapper objectMapper,
            ClientIpResolver clientIpResolver) {
        this(
                enabled,
                objectMapper,
                clientIpResolver,
                Duration.ofSeconds(windowSeconds),
                maxTrackedActors,
                globalMultiplier,
                imageGlobalLimit,
                correctionGlobalLimit,
                Clock.systemUTC(),
                Ticker.systemTicker());
    }

    RateLimitFilter(
            boolean enabled,
            ObjectMapper objectMapper,
            ClientIpResolver clientIpResolver,
            Duration window,
            long maxTrackedActors,
            int globalMultiplier,
            Clock clock,
            Ticker ticker) {
        this(
                enabled,
                objectMapper,
                clientIpResolver,
                window,
                maxTrackedActors,
                globalMultiplier,
                Integer.MAX_VALUE,
                Integer.MAX_VALUE,
                clock,
                ticker);
    }

    RateLimitFilter(
            boolean enabled,
            ObjectMapper objectMapper,
            ClientIpResolver clientIpResolver,
            Duration window,
            long maxTrackedActors,
            int globalMultiplier,
            int imageGlobalLimit,
            Clock clock,
            Ticker ticker) {
        this(
                enabled,
                objectMapper,
                clientIpResolver,
                window,
                maxTrackedActors,
                globalMultiplier,
                imageGlobalLimit,
                Integer.MAX_VALUE,
                clock,
                ticker);
    }

    RateLimitFilter(
            boolean enabled,
            ObjectMapper objectMapper,
            ClientIpResolver clientIpResolver,
            Duration window,
            long maxTrackedActors,
            int globalMultiplier,
            int imageGlobalLimit,
            int correctionGlobalLimit,
            Clock clock,
            Ticker ticker) {
        if (window.compareTo(Duration.ofSeconds(1)) < 0) {
            throw new IllegalArgumentException("rate-limit window는 1초 이상이어야 합니다.");
        }
        if (maxTrackedActors <= 0
                || globalMultiplier <= 0
                || imageGlobalLimit <= 0
                || correctionGlobalLimit <= 0) {
            throw new IllegalArgumentException("rate-limit cache 크기와 global limit은 양수여야 합니다.");
        }
        this.enabled = enabled;
        if (enabled) {
            log.info("애플리케이션 레이트 리미터가 활성화되었습니다.");
        } else {
            log.warn("애플리케이션 레이트 리미터가 비활성화되었습니다.");
        }
        this.objectMapper = objectMapper;
        this.clientIpResolver = clientIpResolver;
        this.window = window;
        this.globalMultiplier = globalMultiplier;
        this.imageGlobalLimit = imageGlobalLimit;
        this.correctionGlobalLimit = correctionGlobalLimit;
        this.clock = clock;
        Duration cacheTtl = window.plusSeconds(1);
        this.actorCounters = Caffeine.newBuilder()
                .maximumSize(maxTrackedActors)
                .expireAfterWrite(cacheTtl)
                .ticker(ticker)
                .build();
        this.globalCounters = Caffeine.newBuilder()
                .maximumSize(RULES.size() * 2L)
                .expireAfterWrite(cacheTtl)
                .ticker(ticker)
                .build();
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        return !enabled;
    }

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain) throws ServletException, IOException {
        Rule matched = match(request);
        if (matched == null) {
            filterChain.doFilter(request, response);
            return;
        }

        long nowEpochSecond = clock.instant().getEpochSecond();
        long windowSeconds = window.toSeconds();
        long windowStart = Math.floorDiv(nowEpochSecond, windowSeconds) * windowSeconds;
        long resetEpochSecond = Math.addExact(windowStart, windowSeconds);
        String actorKey = matched.bucket() + '|' + actorIdentity(request) + '|' + windowStart;
        String globalKey = matched.bucket() + '|' + windowStart;

        int actorCount = increment(actorCounters, actorKey);
        if (actorCount > matched.actorLimit()) {
            reject(request, response, nowEpochSecond, resetEpochSecond);
            return;
        }

        // Requests already rejected by an actor bucket must not let one caller poison the
        // endpoint-global budget for everyone else.
        int globalCount = increment(globalCounters, globalKey);
        if (globalCount > globalLimit(matched)) {
            reject(request, response, nowEpochSecond, resetEpochSecond);
            return;
        }
        filterChain.doFilter(request, response);
    }

    private Rule match(HttpServletRequest request) {
        for (Rule rule : RULES) {
            if (rule.method().equals(request.getMethod())
                    && rule.path().matcher(request.getRequestURI()).matches()) {
                return rule;
            }
        }
        return null;
    }

    private String actorIdentity(HttpServletRequest request) {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication != null
                && authentication.isAuthenticated()
                && authentication.getPrincipal() instanceof Long userId) {
            return "user:" + userId;
        }
        return "ip:" + clientIpResolver.resolve(request);
    }

    private int globalLimit(Rule rule) {
        int multipliedLimit = (int) Math.min(
                Integer.MAX_VALUE, (long) rule.actorLimit() * globalMultiplier);
        return switch (rule.bucket()) {
            case "image-upload" -> Math.min(multipliedLimit, imageGlobalLimit);
            case "correction-write" -> Math.min(multipliedLimit, correctionGlobalLimit);
            default -> multipliedLimit;
        };
    }

    private int increment(Cache<String, AtomicInteger> cache, String key) {
        AtomicInteger counter = cache.get(key, ignored -> new AtomicInteger());
        return counter.updateAndGet(current -> current == Integer.MAX_VALUE ? current : current + 1);
    }

    private void reject(
            HttpServletRequest request,
            HttpServletResponse response,
            long nowEpochSecond,
            long resetEpochSecond) throws IOException {
        long retryAfterSeconds = Math.max(1, resetEpochSecond - nowEpochSecond);
        OffsetDateTime now = OffsetDateTime.ofInstant(clock.instant(), ZoneOffset.UTC);
        OffsetDateTime resetAt = OffsetDateTime.ofInstant(
                Instant.ofEpochSecond(resetEpochSecond),
                ZoneOffset.UTC);

        response.setStatus(429);
        response.setHeader(HttpHeaders.RETRY_AFTER, Long.toString(retryAfterSeconds));
        response.setHeader(RESET_HEADER, Long.toString(resetEpochSecond));
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setCharacterEncoding("UTF-8");
        objectMapper.writeValue(response.getWriter(), new RateLimitErrorResponse(
                now,
                429,
                "Too Many Requests",
                ERROR_CODE,
                "요청이 너무 많습니다. 잠시 후 다시 시도해주세요.",
                Map.of(),
                traceId(request),
                request.getRequestURI(),
                resetAt));
    }

    private String traceId(HttpServletRequest request) {
        Object existing = request.getAttribute("traceId");
        return existing == null ? java.util.UUID.randomUUID().toString() : existing.toString();
    }

    long trackedActorCount() {
        actorCounters.cleanUp();
        return actorCounters.estimatedSize();
    }

    long trackedGlobalCount() {
        globalCounters.cleanUp();
        return globalCounters.estimatedSize();
    }
}
