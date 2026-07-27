package com.fishnote;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.fishnote.bookmark.BookmarkService;
import com.fishnote.bookmark.dto.BookmarkMergeResponse;
import com.fishnote.fish.FishV2Service;
import com.fishnote.fish.dto.FishCatalogResponse;
import com.fishnote.price.FishPriceQueryService;
import com.fishnote.price.ParsedShopPrice;
import com.fishnote.price.PriceImportPersistenceService;
import com.fishnote.price.PriceResolution;
import com.fishnote.price.TelegramPriceImportResponse;
import com.fishnote.price.TelegramPriceWebhookService;
import com.fishnote.price.dto.FishPriceSummaryResponse;
import com.fishnote.review.ReviewV2Service;
import com.fishnote.review.dto.ReviewCursorListResponse;
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Proxy;
import java.math.BigDecimal;
import java.sql.Connection;
import java.sql.SQLException;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.Callable;
import java.util.concurrent.CyclicBarrier;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import javax.sql.DataSource;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.jdbc.DataSourceProperties;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DelegatingDataSource;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

@SpringBootTest
@ActiveProfiles("integration")
@Testcontainers
@Import(PostgreSqlIntegrityContractIntegrationTest.CountingDataSourceConfiguration.class)
class PostgreSqlIntegrityContractIntegrationTest {

    @Container
    private static final PostgreSQLContainer<?> POSTGRESQL =
            new PostgreSQLContainer<>("postgres:16.4-alpine")
                    .withDatabaseName("fishnote_integrity")
                    .withUsername("fishnote")
                    .withPassword("fishnote");

    @DynamicPropertySource
    static void configurePostgreSql(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", POSTGRESQL::getJdbcUrl);
        registry.add("spring.datasource.username", POSTGRESQL::getUsername);
        registry.add("spring.datasource.password", POSTGRESQL::getPassword);
        registry.add("spring.datasource.driver-class-name", POSTGRESQL::getDriverClassName);
    }

    @TestConfiguration(proxyBeanMethods = false)
    static class CountingDataSourceConfiguration {

        @Bean
        @Primary
        CountingDataSource dataSource(DataSourceProperties properties) {
            DriverManagerDataSource target = new DriverManagerDataSource();
            target.setDriverClassName(properties.determineDriverClassName());
            target.setUrl(properties.determineUrl());
            target.setUsername(properties.determineUsername());
            target.setPassword(properties.determinePassword());
            return new CountingDataSource(target);
        }
    }

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private CountingDataSource dataSource;

    @Autowired
    private FishV2Service fishService;

    @Autowired
    private ReviewV2Service reviewService;

    @Autowired
    private FishPriceQueryService priceService;

    @Autowired
    private PriceImportPersistenceService priceImportService;

    @Autowired
    private BookmarkService bookmarkService;

    @Autowired
    private TelegramPriceWebhookService telegramWebhookService;

    private static Long detailFishId;

    @BeforeAll
    static void seedBatchBoundaryFixture(
            @Autowired JdbcTemplate jdbcTemplate,
            @Autowired CountingDataSource dataSource) {
        detailFishId = jdbcTemplate.queryForObject(
                """
                INSERT INTO fish (
                    name, slug, category, description, price_level, featured, created_at
                ) VALUES (
                    'PG예산어종001', 'pg-budget-fish-1', 'FISH',
                    'PostgreSQL query budget fixture', 2, true, now()
                ) RETURNING id
                """,
                Long.class);
        jdbcTemplate.update(
                """
                INSERT INTO fish (
                    name, slug, category, description, price_level, featured, created_at
                )
                SELECT
                    'PG예산어종' || lpad(series::text, 3, '0'),
                    'pg-budget-fish-' || series,
                    'FISH',
                    'PostgreSQL query budget fixture',
                    (series % 3 + 1)::smallint,
                    series % 2 = 0,
                    now()
                FROM generate_series(2, 101) AS series
                """);
        jdbcTemplate.update(
                """
                INSERT INTO fish_season_month (fish_id, month)
                SELECT fish.id, month::smallint
                FROM fish
                CROSS JOIN generate_series(1, 12) AS month
                WHERE fish.name LIKE 'PG예산어종%'
                """);
        jdbcTemplate.update(
                """
                INSERT INTO fish_taste_tag (fish_id, tag)
                SELECT fish.id, tags.tag
                FROM fish
                CROSS JOIN unnest(ARRAY['담백', '고소', '쫄깃', '기름진', '감칠맛']) AS tags(tag)
                WHERE fish.name LIKE 'PG예산어종%'
                """);
        jdbcTemplate.update(
                """
                INSERT INTO fish_similar (fish_id, similar_fish_id)
                SELECT ?, candidates.id
                FROM (
                    SELECT id
                    FROM fish
                    WHERE name LIKE 'PG예산어종%'
                      AND id <> ?
                    ORDER BY id
                    LIMIT 10
                ) candidates
                """,
                detailFishId,
                detailFishId);
        jdbcTemplate.update(
                """
                INSERT INTO review (fish_id, nickname, rating, content, created_at)
                SELECT
                    ?,
                    'pg-reviewer-' || series,
                    (series % 5 + 1)::smallint,
                    'PG query fixture review ' || series,
                    now() - series * interval '1 second'
                FROM generate_series(1, 10000) AS series
                """,
                detailFishId);
        jdbcTemplate.update(
                """
                INSERT INTO shop_price_observation (
                    fish_id, observed_at, source_type, source_name, canonical_fish_name,
                    reported_name, condition, origin, size_grade, unit,
                    price_min_krw, price_max_krw, confidence, raw_text, dedup_hash
                )
                SELECT
                    ?,
                    now() - day_index * interval '1 day' - shop_index * interval '1 minute',
                    't1_fixture',
                    '테스트상회' || shop_index,
                    'PG예산어종001',
                    'PG예산어종001',
                    CASE WHEN shop_index % 2 = 0 THEN '자연산' ELSE '양식' END,
                    CASE WHEN shop_index % 2 = 0 THEN '동해' ELSE '제주' END,
                    shop_index || 'kg',
                    'kg',
                    10000 + day_index * 100 + shop_index * 10,
                    11000 + day_index * 100 + shop_index * 10,
                    0.90,
                    'PG price fixture ' || day_index || '-' || shop_index,
                    encode(digest(
                        convert_to('pg-budget-' || ? || '-' || day_index || '-' || shop_index, 'UTF8'),
                        'sha256'
                    ), 'hex')
                FROM generate_series(0, 29) AS day_index
                CROSS JOIN generate_series(1, 4) AS shop_index
                """,
                detailFishId,
                detailFishId);
        dataSource.clearCounts();
    }

    @Test
    void postgresqlReadPathsStayInsideBudgetsBeyondBatchBoundaries() {
        dataSource.clearCounts();
        FishCatalogResponse catalog = fishService.findFishes(
                "PG예산어종", null, null, null, null, null, null, "name", 24, null);
        assertThat(catalog.items()).hasSize(24);
        assertThat(catalog.pageInfo().hasNext()).isTrue();
        assertThat(dataSource.selectCount()).isLessThanOrEqualTo(4);

        dataSource.clearCounts();
        var detail = fishService.getFish(detailFishId.toString());
        assertThat(detail.seasonMonths()).hasSize(12);
        assertThat(detail.tasteTags()).hasSize(5);
        assertThat(detail.similarFishes()).hasSize(10);
        assertThat(dataSource.selectCount()).isLessThanOrEqualTo(3);

        dataSource.clearCounts();
        ReviewCursorListResponse firstReviews = reviewService.findReviews(
                detailFishId, "latest", 100, null, true, null);
        assertThat(firstReviews.items()).hasSize(100);
        assertThat(firstReviews.pageInfo().hasNext()).isTrue();
        assertThat(dataSource.selectCount()).isLessThanOrEqualTo(2);

        dataSource.clearCounts();
        ReviewCursorListResponse nextReviews = reviewService.findReviews(
                detailFishId,
                "latest",
                100,
                firstReviews.pageInfo().nextCursor(),
                false,
                null);
        assertThat(nextReviews.items()).hasSize(100);
        assertThat(dataSource.selectCount()).isLessThanOrEqualTo(1);

        dataSource.clearCounts();
        FishPriceSummaryResponse prices = priceService.getRecentPrices(
                detailFishId, 30, PriceResolution.DAY, 30, null);
        assertThat(prices.observationCount()).isEqualTo(120);
        assertThat(prices.byShop()).hasSize(4);
        assertThat(dataSource.selectCount()).isLessThanOrEqualTo(2);
    }

    @Test
    void oneHundredRowPriceImportUsesAtMostThreeDatabaseStatements() {
        String marker = "t1-import-budget-" + UUID.randomUUID();
        OffsetDateTime observedAt = OffsetDateTime.parse("2026-07-23T08:00:00+09:00");
        List<ParsedShopPrice> rows = new ArrayList<>();
        for (int index = 0; index < 100; index++) {
            rows.add(new ParsedShopPrice(
                    observedAt.plusSeconds(index),
                    "t1_contract",
                    "예산상회",
                    null,
                    "PG예산어종001",
                    "PG예산어종001",
                    "양식",
                    "제주",
                    "2kg",
                    "kg",
                    30_000 + index,
                    32_000 + index,
                    new BigDecimal("0.90"),
                    marker + "-" + index));
        }

        try {
            dataSource.clearCounts();
            TelegramPriceImportResponse response = priceImportService.persist(rows, List.of("예산상회"), null);

            assertThat(response.savedCount()).isEqualTo(100);
            assertThat(dataSource.statementCount())
                    .as("one canonical-id read plus one bulk insert must stay within the three-round-trip budget")
                    .isLessThanOrEqualTo(3);
        } finally {
            jdbcTemplate.update(
                    "DELETE FROM shop_price_observation WHERE raw_text LIKE ?",
                    marker + "%");
        }
    }

    @Test
    void bookmarkListUsesAtMostThreeSelectsWithoutPluralEntityGraphs() {
        String email = "bookmark-budget-" + UUID.randomUUID() + "@example.com";
        Long userId = jdbcTemplate.queryForObject(
                """
                INSERT INTO users(email, password_hash, nickname, created_at)
                VALUES (?, 'hash', '북마크예산', now())
                RETURNING id
                """,
                Long.class,
                email);
        List<Long> fishIds = jdbcTemplate.queryForList(
                "SELECT id FROM fish WHERE name LIKE 'PG예산어종%' ORDER BY id LIMIT 2",
                Long.class);
        jdbcTemplate.update(
                """
                INSERT INTO user_bookmark(user_id, fish_id, created_at)
                VALUES (?, ?, now() - interval '1 second'), (?, ?, now())
                """,
                userId,
                fishIds.get(0),
                userId,
                fishIds.get(1));

        try {
            dataSource.clearCounts();
            var bookmarks = bookmarkService.findBookmarks(userId);

            assertThat(bookmarks).hasSize(2);
            assertThat(bookmarks.get(0).seasonMonths()).hasSize(12);
            assertThat(bookmarks.get(0).tasteTags()).hasSize(5);
            assertThat(dataSource.selectCount())
                    .as("user existence, scalar/rating/media, and combined collection reads")
                    .isLessThanOrEqualTo(3);
        } finally {
            jdbcTemplate.update("DELETE FROM user_bookmark WHERE user_id = ?", userId);
            jdbcTemplate.update("DELETE FROM users WHERE id = ?", userId);
        }
    }

    @Test
    void twentyConcurrentIdenticalBookmarkMergesCreateNoDuplicates() throws Exception {
        Long userId = jdbcTemplate.queryForObject(
                """
                INSERT INTO users(email, password_hash, nickname, created_at)
                VALUES (?, NULL, 'T1 merge tester', now())
                RETURNING id
                """,
                Long.class,
                "t1-merge-" + UUID.randomUUID() + "@example.com");
        List<Long> fishIds = jdbcTemplate.queryForList(
                "SELECT id FROM fish ORDER BY id LIMIT 20",
                Long.class);
        try {
            List<BookmarkMergeResponse> responses = race(
                    20,
                    () -> bookmarkService.mergeBookmarks(userId, fishIds));

            assertThat(responses).hasSize(20);
            assertThat(jdbcTemplate.queryForObject(
                            """
                            SELECT count(*) FROM user_bookmark
                            WHERE user_id = ?
                            """,
                            Long.class,
                            userId))
                    .isEqualTo((long) fishIds.size());
            assertThat(jdbcTemplate.queryForObject(
                            """
                            SELECT count(DISTINCT fish_id) FROM user_bookmark
                            WHERE user_id = ?
                            """,
                            Long.class,
                            userId))
                    .isEqualTo((long) fishIds.size());
        } finally {
            jdbcTemplate.update("DELETE FROM users WHERE id = ?", userId);
        }
    }

    @Test
    void twentyConcurrentIdenticalWebhookImportsPersistOneRowSet() throws Exception {
        String rawPriceLine = "제주광어1kgㅡ54321";
        String text = "2026년07월23일 윤호수산 시세단가\n" + rawPriceLine;
        OffsetDateTime observedAt = OffsetDateTime.parse("2026-07-23T08:00:00+09:00");
        try {
            List<TelegramPriceImportResponse> responses = race(
                    20,
                    () -> telegramWebhookService.importAndQueueReply(text, observedAt, null));

            assertThat(responses).hasSize(20);
            assertThat(responses).extracting(TelegramPriceImportResponse::parsedCount).containsOnly(1);
            assertThat(responses.stream().mapToInt(TelegramPriceImportResponse::savedCount).sum())
                    .isEqualTo(1);
            assertThat(jdbcTemplate.queryForObject(
                            """
                            SELECT count(*)
                            FROM shop_price_observation
                            WHERE raw_text = ? AND price_min_krw = 54321 AND price_max_krw = 54321
                            """,
                            Long.class,
                            rawPriceLine))
                    .isOne();
        } finally {
            jdbcTemplate.update(
                    "DELETE FROM shop_price_observation WHERE raw_text = ? AND price_min_krw = 54321",
                    rawPriceLine);
        }
    }

    @Test
    void priceCheckRejectsNonPositiveAndInvertedRanges() {
        String marker = "t1-price-check-" + UUID.randomUUID();
        try {
            assertThatThrownBy(() -> insertPrice(marker + "-zero", 0, 10_000, "1".repeat(64)))
                    .isInstanceOf(DataIntegrityViolationException.class);
            assertThatThrownBy(() -> insertPrice(marker + "-inverted", 20_000, 10_000, "2".repeat(64)))
                    .isInstanceOf(DataIntegrityViolationException.class);
            assertThatThrownBy(() -> insertPrice(
                            marker + "-low-confidence",
                            10_000,
                            20_000,
                            new BigDecimal("-0.01"),
                            "4".repeat(64)))
                    .isInstanceOf(DataIntegrityViolationException.class);
            assertThatThrownBy(() -> insertPrice(
                            marker + "-high-confidence",
                            10_000,
                            20_000,
                            new BigDecimal("1.01"),
                            "5".repeat(64)))
                    .isInstanceOf(DataIntegrityViolationException.class);

            insertPrice(marker + "-valid", 10_000, 20_000, "3".repeat(64));
            assertThat(jdbcTemplate.queryForObject(
                            "SELECT count(*) FROM shop_price_observation WHERE raw_text LIKE ?",
                            Long.class,
                            marker + "%"))
                    .isOne();
        } finally {
            jdbcTemplate.update(
                    "DELETE FROM shop_price_observation WHERE raw_text LIKE ?",
                    marker + "%");
        }
    }

    @Test
    void concurrentReviewCreatesAndDeletesKeepTheReadModelEqualToLiveAggregates() throws Exception {
        String marker = "t1-review-stat-" + UUID.randomUUID();
        int pairs = 10;
        List<Long> deleteIds = new ArrayList<>();
        for (int index = 0; index < pairs; index++) {
            deleteIds.add(jdbcTemplate.queryForObject(
                    """
                    INSERT INTO review (fish_id, nickname, rating, content, created_at)
                    VALUES (?, ?, ?, ?, now())
                    RETURNING id
                    """,
                    Long.class,
                    detailFishId,
                    "삭제대상" + index,
                    (index % 5) + 1,
                    marker + "-delete-" + index));
        }

        int workers = pairs * 2;
        CyclicBarrier barrier = new CyclicBarrier(workers);
        ExecutorService executor = Executors.newFixedThreadPool(workers);
        List<Future<?>> futures = new ArrayList<>();
        try {
            for (int index = 0; index < pairs; index++) {
                int fixtureIndex = index;
                futures.add(executor.submit(() -> {
                    barrier.await();
                    jdbcTemplate.update(
                            """
                            INSERT INTO review (fish_id, nickname, rating, content, created_at)
                            VALUES (?, ?, ?, ?, now())
                            """,
                            detailFishId,
                            "동시생성" + fixtureIndex,
                            (fixtureIndex % 5) + 1,
                            marker + "-create-" + fixtureIndex);
                    return null;
                }));
            }
            for (Long reviewId : deleteIds) {
                futures.add(executor.submit(() -> {
                    barrier.await();
                    jdbcTemplate.update("DELETE FROM review WHERE id = ?", reviewId);
                    return null;
                }));
            }

            for (Future<?> future : futures) {
                future.get(30, TimeUnit.SECONDS);
            }
            assertReviewStatMatchesLiveAggregate(detailFishId);
        } finally {
            executor.shutdownNow();
            jdbcTemplate.update("DELETE FROM review WHERE content LIKE ?", marker + "%");
        }

        assertReviewStatMatchesLiveAggregate(detailFishId);
    }

    private void insertPrice(String rawText, int minimum, int maximum, String dedupHash) {
        insertPrice(rawText, minimum, maximum, new BigDecimal("0.90"), dedupHash);
    }

    private void insertPrice(
            String rawText,
            int minimum,
            int maximum,
            BigDecimal confidence,
            String dedupHash) {
        jdbcTemplate.update(
                """
                INSERT INTO shop_price_observation (
                    observed_at, source_type, reported_name, price_min_krw,
                    price_max_krw, confidence, raw_text, dedup_hash
                ) VALUES (now(), 't1_contract', '광어', ?, ?, ?, ?, ?)
                """,
                minimum,
                maximum,
                confidence,
                rawText,
                dedupHash);
    }

    private void assertReviewStatMatchesLiveAggregate(long fishId) {
        Map<String, Object> aggregate = jdbcTemplate.queryForMap(
                """
                SELECT
                    stat.review_count,
                    stat.rating_count,
                    stat.rating_sum,
                    stat.rating_1_count,
                    stat.rating_2_count,
                    stat.rating_3_count,
                    stat.rating_4_count,
                    stat.rating_5_count,
                    count(review.id) AS live_review_count,
                    count(review.rating) AS live_rating_count,
                    coalesce(sum(review.rating), 0) AS live_rating_sum,
                    count(*) FILTER (WHERE review.rating = 1) AS live_rating_1_count,
                    count(*) FILTER (WHERE review.rating = 2) AS live_rating_2_count,
                    count(*) FILTER (WHERE review.rating = 3) AS live_rating_3_count,
                    count(*) FILTER (WHERE review.rating = 4) AS live_rating_4_count,
                    count(*) FILTER (WHERE review.rating = 5) AS live_rating_5_count
                FROM fish_review_stat stat
                LEFT JOIN review ON review.fish_id = stat.fish_id
                WHERE stat.fish_id = ?
                GROUP BY stat.fish_id
                """,
                fishId);

        for (String field : List.of(
                "review_count",
                "rating_count",
                "rating_sum",
                "rating_1_count",
                "rating_2_count",
                "rating_3_count",
                "rating_4_count",
                "rating_5_count")) {
            long stored = ((Number) aggregate.get(field)).longValue();
            long live = ((Number) aggregate.get("live_" + field)).longValue();
            assertThat(stored).as(field).isEqualTo(live);
        }
    }

    private <T> List<T> race(int workers, Callable<T> operation) throws Exception {
        CyclicBarrier barrier = new CyclicBarrier(workers);
        ExecutorService executor = Executors.newFixedThreadPool(workers);
        List<Future<T>> futures = new ArrayList<>(workers);
        try {
            for (int index = 0; index < workers; index++) {
                futures.add(executor.submit(() -> {
                    barrier.await(10, TimeUnit.SECONDS);
                    return operation.call();
                }));
            }
            List<T> results = new ArrayList<>(workers);
            for (Future<T> future : futures) {
                results.add(future.get(30, TimeUnit.SECONDS));
            }
            return results;
        } finally {
            executor.shutdownNow();
            executor.awaitTermination(5, TimeUnit.SECONDS);
        }
    }

    static final class CountingDataSource extends DelegatingDataSource {

        private final AtomicInteger selectCount = new AtomicInteger();
        private final AtomicInteger statementCount = new AtomicInteger();

        CountingDataSource(DataSource targetDataSource) {
            super(targetDataSource);
        }

        @Override
        public Connection getConnection() throws SQLException {
            return wrap(super.getConnection());
        }

        @Override
        public Connection getConnection(String username, String password) throws SQLException {
            return wrap(super.getConnection(username, password));
        }

        void clearCounts() {
            selectCount.set(0);
            statementCount.set(0);
        }

        int selectCount() {
            return selectCount.get();
        }

        int statementCount() {
            return statementCount.get();
        }

        private Connection wrap(Connection target) {
            return (Connection) Proxy.newProxyInstance(
                    Connection.class.getClassLoader(),
                    new Class<?>[] {Connection.class},
                    (proxy, method, args) -> {
                        if (("prepareStatement".equals(method.getName())
                                        || "prepareCall".equals(method.getName()))
                                && args != null
                                && args.length > 0
                                && args[0] instanceof String sql) {
                            statementCount.incrementAndGet();
                            if (isSelect(sql)) {
                                selectCount.incrementAndGet();
                            }
                        }
                        try {
                            return method.invoke(target, args);
                        } catch (InvocationTargetException exception) {
                            throw exception.getTargetException();
                        }
                    });
        }

        private boolean isSelect(String sql) {
            String normalized = sql.stripLeading().toUpperCase(Locale.ROOT);
            return normalized.startsWith("SELECT") || normalized.startsWith("WITH");
        }
    }
}
