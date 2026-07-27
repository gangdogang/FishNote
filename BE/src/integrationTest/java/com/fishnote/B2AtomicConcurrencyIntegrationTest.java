package com.fishnote;

import static org.assertj.core.api.Assertions.assertThat;

import com.fishnote.bookmark.BookmarkService;
import com.fishnote.bookmark.dto.BookmarkMergeResponse;
import com.fishnote.review.ReviewService;
import com.fishnote.user.KakaoAccountService;
import com.fishnote.user.KakaoOAuthClient;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.Callable;
import java.util.concurrent.CyclicBarrier;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

@SpringBootTest
@ActiveProfiles("integration")
@Testcontainers
class B2AtomicConcurrencyIntegrationTest {

    @Container
    private static final PostgreSQLContainer<?> POSTGRESQL =
            new PostgreSQLContainer<>("postgres:16.4-alpine")
                    .withDatabaseName("fishnote_b2_integration")
                    .withUsername("fishnote")
                    .withPassword("fishnote");

    @DynamicPropertySource
    static void configurePostgreSql(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", POSTGRESQL::getJdbcUrl);
        registry.add("spring.datasource.username", POSTGRESQL::getUsername);
        registry.add("spring.datasource.password", POSTGRESQL::getPassword);
        registry.add("spring.datasource.driver-class-name", POSTGRESQL::getDriverClassName);
    }

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private BookmarkService bookmarkService;

    @Autowired
    private ReviewService reviewService;

    @Autowired
    private KakaoAccountService kakaoAccountService;

    @Test
    void oneHundredConcurrentBookmarkPutsAreIdempotent() throws Exception {
        Long userId = createUser("b2-bookmark-" + UUID.randomUUID() + "@example.com");
        Long fishId = jdbcTemplate.queryForObject("SELECT min(id) FROM fish", Long.class);
        try {
            race(100, () -> {
                bookmarkService.addBookmark(userId, fishId);
                return null;
            });

            assertThat(jdbcTemplate.queryForObject(
                            "SELECT count(*) FROM user_bookmark WHERE user_id = ? AND fish_id = ?",
                            Long.class,
                            userId,
                            fishId))
                    .isEqualTo(1L);
        } finally {
            jdbcTemplate.update("DELETE FROM users WHERE id = ?", userId);
        }
    }

    @Test
    void oneHundredConcurrentHelpfulVotesAllSucceedButIncrementOnce() throws Exception {
        Long fishId = jdbcTemplate.queryForObject("SELECT min(id) FROM fish", Long.class);
        Long reviewId = jdbcTemplate.queryForObject(
                """
                INSERT INTO review(
                    fish_id, nickname, rating, content, password_hash, helpful_count, created_at
                ) VALUES (?, '테스터', 5, '동시성 후기', NULL, 4, CURRENT_TIMESTAMP)
                RETURNING id
                """,
                Long.class,
                fishId);
        try {
            race(100, () -> reviewService.increaseHelpfulCount(
                    reviewId,
                    null,
                    "203.0.113.77"));

            assertThat(jdbcTemplate.queryForObject(
                            "SELECT helpful_count FROM review WHERE id = ?",
                            Integer.class,
                            reviewId))
                    .isEqualTo(5);
            assertThat(jdbcTemplate.queryForObject(
                            "SELECT count(*) FROM review_helpful_vote WHERE review_id = ?",
                            Long.class,
                            reviewId))
                    .isEqualTo(1L);
        } finally {
            jdbcTemplate.update("DELETE FROM review WHERE id = ?", reviewId);
        }
    }

    @Test
    void mergeAcceptsExistingDistinctFishAndSkipsMissingOrDuplicateInputs() {
        Long userId = createUser("b2-merge-" + UUID.randomUUID() + "@example.com");
        List<Long> existingFishIds = jdbcTemplate.queryForList(
                "SELECT id FROM fish ORDER BY id",
                Long.class);
        List<Long> requested = new ArrayList<>(existingFishIds);
        requested.addAll(existingFishIds.subList(0, Math.min(10, existingFishIds.size())));
        while (requested.size() < 500) {
            requested.add(-1_000_000L - requested.size());
        }
        try {
            BookmarkMergeResponse response = bookmarkService.mergeBookmarks(userId, requested);

            assertThat(response.acceptedCount()).isEqualTo(existingFishIds.size());
            assertThat(response.skippedCount()).isEqualTo(500 - existingFishIds.size());
            assertThat(jdbcTemplate.queryForObject(
                            "SELECT count(*) FROM user_bookmark WHERE user_id = ?",
                            Long.class,
                            userId))
                    .isEqualTo((long) existingFishIds.size());
            assertThat(jdbcTemplate.queryForList(
                            """
                            SELECT fish_id FROM user_bookmark
                            WHERE user_id = ?
                            ORDER BY created_at, fish_id
                            """,
                            Long.class,
                            userId))
                    .containsExactlyElementsOf(existingFishIds);
        } finally {
            jdbcTemplate.update("DELETE FROM users WHERE id = ?", userId);
        }
    }

    @Test
    void concurrentFirstKakaoLoginCreatesOneUserAndOneProviderAccount() throws Exception {
        String suffix = UUID.randomUUID().toString();
        String providerUserId = "b2-provider-" + suffix;
        String email = "b2-oauth-" + suffix + "@example.com";
        KakaoOAuthClient.KakaoUser kakaoUser = new KakaoOAuthClient.KakaoUser(
                providerUserId,
                email,
                "동시성 테스터",
                true);

        List<KakaoAccountService.KakaoAccount> accounts = race(
                100,
                () -> kakaoAccountService.login(kakaoUser));
        Set<Long> userIds = new LinkedHashSet<>(accounts.stream()
                .map(KakaoAccountService.KakaoAccount::userId)
                .toList());

        assertThat(userIds).hasSize(1);
        assertThat(jdbcTemplate.queryForObject(
                        "SELECT count(*) FROM users WHERE email = ?",
                        Long.class,
                        email))
                .isEqualTo(1L);
        assertThat(jdbcTemplate.queryForObject(
                        """
                        SELECT count(*) FROM user_oauth_account
                        WHERE provider = 'KAKAO' AND provider_user_id = ?
                        """,
                        Long.class,
                        providerUserId))
                .isEqualTo(1L);

        jdbcTemplate.update("DELETE FROM users WHERE id = ?", userIds.iterator().next());
    }

    private Long createUser(String email) {
        return jdbcTemplate.queryForObject(
                """
                INSERT INTO users(email, password_hash, nickname, created_at)
                VALUES (?, NULL, '테스터', CURRENT_TIMESTAMP)
                RETURNING id
                """,
                Long.class,
                email);
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
}
