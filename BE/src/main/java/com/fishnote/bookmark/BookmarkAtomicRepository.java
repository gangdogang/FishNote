package com.fishnote.bookmark;

import com.fishnote.bookmark.dto.BookmarkMergeResponse;
import java.sql.Array;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.jdbc.core.ConnectionCallback;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

/**
 * Atomic bookmark writes for PostgreSQL, with a small portable path for H2 smoke tests.
 *
 * <p>The PostgreSQL merge deliberately stays in one statement: the request array is expanded
 * with ordinality, duplicates are removed by first occurrence, existing fish are selected, and
 * the rows are inserted with {@code ON CONFLICT DO NOTHING}. This keeps the SQL count independent
 * of the number of requested fish.</p>
 */
@Repository
public class BookmarkAtomicRepository {

    private static final String POSTGRES_ADD_SQL = """
            WITH actor AS (
                SELECT id FROM users WHERE id = ?
            ), candidate AS (
                SELECT id FROM fish WHERE id = ?
            ), ins AS (
                INSERT INTO user_bookmark(user_id, fish_id, created_at)
                SELECT actor.id, candidate.id, CURRENT_TIMESTAMP
                FROM actor CROSS JOIN candidate
                ON CONFLICT (user_id, fish_id) DO NOTHING
                RETURNING fish_id
            )
            SELECT EXISTS(SELECT 1 FROM actor) AS user_exists,
                   EXISTS(SELECT 1 FROM candidate) AS fish_exists,
                   EXISTS(SELECT 1 FROM ins) AS inserted
            """;

    private static final String POSTGRES_MERGE_SQL = """
            WITH actor AS (
                SELECT id FROM users WHERE id = ?
            ), requested AS (
                SELECT requested.fish_id, requested.ordinality
                FROM unnest(CAST(? AS BIGINT[])) WITH ORDINALITY
                     AS requested(fish_id, ordinality)
            ), deduplicated AS (
                SELECT DISTINCT ON (fish_id) fish_id, ordinality
                FROM requested
                ORDER BY fish_id, ordinality
            ), accepted AS (
                SELECT deduplicated.fish_id, deduplicated.ordinality
                FROM deduplicated
                JOIN fish ON fish.id = deduplicated.fish_id
            ), ins AS (
                INSERT INTO user_bookmark(user_id, fish_id, created_at)
                SELECT actor.id,
                       accepted.fish_id,
                       CURRENT_TIMESTAMP
                           + (accepted.ordinality - 1) * INTERVAL '1 millisecond'
                FROM actor CROSS JOIN accepted
                ORDER BY accepted.ordinality
                ON CONFLICT (user_id, fish_id) DO NOTHING
                RETURNING fish_id
            )
            SELECT EXISTS(SELECT 1 FROM actor) AS user_exists,
                   (SELECT count(*) FROM accepted) AS accepted_count,
                   (SELECT count(*) FROM requested)
                       - (SELECT count(*) FROM accepted) AS skipped_count
            """;

    private final JdbcTemplate jdbcTemplate;
    private final NamedParameterJdbcTemplate namedJdbcTemplate;

    public BookmarkAtomicRepository(
            JdbcTemplate jdbcTemplate,
            NamedParameterJdbcTemplate namedJdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
        this.namedJdbcTemplate = namedJdbcTemplate;
    }

    public BookmarkPutResult add(Long userId, Long fishId) {
        return jdbcTemplate.execute((ConnectionCallback<BookmarkPutResult>) connection ->
                isPostgreSql(connection)
                        ? addPostgreSql(connection, userId, fishId)
                        : addPortable(userId, fishId));
    }

    public BookmarkMergeResult merge(Long userId, List<Long> fishIds) {
        return jdbcTemplate.execute((ConnectionCallback<BookmarkMergeResult>) connection ->
                isPostgreSql(connection)
                        ? mergePostgreSql(connection, userId, fishIds)
                        : mergePortable(userId, fishIds));
    }

    private BookmarkPutResult addPostgreSql(Connection connection, Long userId, Long fishId)
            throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(POSTGRES_ADD_SQL)) {
            statement.setLong(1, userId);
            statement.setLong(2, fishId);
            try (ResultSet result = statement.executeQuery()) {
                if (!result.next()) {
                    throw new IllegalStateException("북마크 원자 쿼리가 결과를 반환하지 않았습니다.");
                }
                return new BookmarkPutResult(
                        result.getBoolean("user_exists"),
                        result.getBoolean("fish_exists"),
                        result.getBoolean("inserted"));
            }
        }
    }

    private BookmarkMergeResult mergePostgreSql(
            Connection connection,
            Long userId,
            List<Long> fishIds) throws SQLException {
        Array requestedIds = connection.createArrayOf("bigint", fishIds.toArray(Long[]::new));
        try {
            try (PreparedStatement statement = connection.prepareStatement(POSTGRES_MERGE_SQL)) {
                statement.setLong(1, userId);
                statement.setArray(2, requestedIds);
                try (ResultSet result = statement.executeQuery()) {
                    if (!result.next()) {
                        throw new IllegalStateException("북마크 병합 원자 쿼리가 결과를 반환하지 않았습니다.");
                    }
                    return new BookmarkMergeResult(
                            result.getBoolean("user_exists"),
                            new BookmarkMergeResponse(
                                    result.getInt("accepted_count"),
                                    result.getInt("skipped_count")));
                }
            }
        } finally {
            requestedIds.free();
        }
    }

    private BookmarkPutResult addPortable(Long userId, Long fishId) {
        boolean userExists = exists("users", userId);
        boolean fishExists = exists("fish", fishId);
        if (!userExists || !fishExists) {
            return new BookmarkPutResult(userExists, fishExists, false);
        }
        int inserted = jdbcTemplate.update(
                """
                INSERT INTO user_bookmark(user_id, fish_id, created_at)
                SELECT ?, ?, CURRENT_TIMESTAMP
                WHERE NOT EXISTS (
                    SELECT 1 FROM user_bookmark WHERE user_id = ? AND fish_id = ?
                )
                """,
                userId,
                fishId,
                userId,
                fishId);
        return new BookmarkPutResult(true, true, inserted == 1);
    }

    private BookmarkMergeResult mergePortable(Long userId, List<Long> fishIds) {
        if (!exists("users", userId)) {
            return new BookmarkMergeResult(false, new BookmarkMergeResponse(0, fishIds.size()));
        }
        List<Long> requestedIds = new ArrayList<>(new LinkedHashSet<>(fishIds));
        if (requestedIds.isEmpty()) {
            return new BookmarkMergeResult(true, new BookmarkMergeResponse(0, 0));
        }
        Set<Long> existingIds = new LinkedHashSet<>(namedJdbcTemplate.queryForList(
                "SELECT id FROM fish WHERE id IN (:fishIds)",
                Map.of("fishIds", requestedIds),
                Long.class));
        OffsetDateTime baseCreatedAt = OffsetDateTime.now();
        int order = 0;
        for (Long fishId : requestedIds) {
            if (!existingIds.contains(fishId)) {
                continue;
            }
            jdbcTemplate.update(
                    """
                    INSERT INTO user_bookmark(user_id, fish_id, created_at)
                    SELECT ?, ?, ?
                    WHERE NOT EXISTS (
                        SELECT 1 FROM user_bookmark WHERE user_id = ? AND fish_id = ?
                    )
                    """,
                    userId,
                    fishId,
                    Timestamp.from(baseCreatedAt.plusNanos(order++ * 1_000_000L).toInstant()),
                    userId,
                    fishId);
        }
        int accepted = existingIds.size();
        return new BookmarkMergeResult(
                true,
                new BookmarkMergeResponse(accepted, fishIds.size() - accepted));
    }

    private boolean exists(String table, Long id) {
        Integer count = jdbcTemplate.queryForObject(
                "SELECT count(*) FROM " + table + " WHERE id = ?",
                Integer.class,
                id);
        return count != null && count > 0;
    }

    private boolean isPostgreSql(Connection connection) throws SQLException {
        return "PostgreSQL".equals(connection.getMetaData().getDatabaseProductName());
    }

    public record BookmarkPutResult(boolean userExists, boolean fishExists, boolean inserted) {
    }

    public record BookmarkMergeResult(boolean userExists, BookmarkMergeResponse response) {
    }
}
