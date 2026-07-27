package com.fishnote.review;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.Optional;
import org.springframework.jdbc.core.ConnectionCallback;
import org.springframework.jdbc.core.JdbcTemplate;

/** Spring Data repository fragment for one-statement PostgreSQL helpful voting. */
public class ReviewHelpfulVoteAtomicOperationsImpl implements ReviewHelpfulVoteAtomicOperations {

    private static final String POSTGRES_ATOMIC_HELPFUL_SQL = """
            WITH ins AS (
                INSERT INTO review_helpful_vote(review_id, voter_key)
                SELECT id, ? FROM review WHERE id = ?
                ON CONFLICT (review_id, voter_key) DO NOTHING
                RETURNING review_id
            ), upd AS (
                UPDATE review
                SET helpful_count = helpful_count + 1
                WHERE id IN (SELECT review_id FROM ins)
                RETURNING helpful_count
            )
            SELECT helpful_count FROM upd
            UNION ALL
            SELECT helpful_count FROM review
            WHERE id = ? AND NOT EXISTS (SELECT 1 FROM upd)
            LIMIT 1
            """;

    private final JdbcTemplate jdbcTemplate;

    public ReviewHelpfulVoteAtomicOperationsImpl(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @Override
    public Optional<Integer> increaseHelpfulCountAtomically(Long reviewId, String voterKey) {
        return jdbcTemplate.execute((ConnectionCallback<Optional<Integer>>) connection ->
                isPostgreSql(connection)
                        ? increasePostgreSql(connection, reviewId, voterKey)
                        : increasePortable(reviewId, voterKey));
    }

    private Optional<Integer> increasePostgreSql(
            Connection connection,
            Long reviewId,
            String voterKey) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(POSTGRES_ATOMIC_HELPFUL_SQL)) {
            statement.setString(1, voterKey);
            statement.setLong(2, reviewId);
            statement.setLong(3, reviewId);
            try (ResultSet result = statement.executeQuery()) {
                return result.next()
                        ? Optional.of(result.getInt("helpful_count"))
                        : Optional.empty();
            }
        }
    }

    private Optional<Integer> increasePortable(Long reviewId, String voterKey) {
        Integer current = jdbcTemplate.query(
                "SELECT helpful_count FROM review WHERE id = ?",
                result -> result.next() ? result.getInt(1) : null,
                reviewId);
        if (current == null) {
            return Optional.empty();
        }

        int inserted = jdbcTemplate.update(
                """
                INSERT INTO review_helpful_vote(review_id, voter_key, created_at)
                SELECT ?, ?, CURRENT_TIMESTAMP
                WHERE NOT EXISTS (
                    SELECT 1 FROM review_helpful_vote
                    WHERE review_id = ? AND voter_key = ?
                )
                """,
                reviewId,
                voterKey,
                reviewId,
                voterKey);
        if (inserted == 1) {
            jdbcTemplate.update(
                    "UPDATE review SET helpful_count = helpful_count + 1 WHERE id = ?",
                    reviewId);
        }
        return Optional.ofNullable(jdbcTemplate.queryForObject(
                "SELECT helpful_count FROM review WHERE id = ?",
                Integer.class,
                reviewId));
    }

    private boolean isPostgreSql(Connection connection) throws SQLException {
        return "PostgreSQL".equals(connection.getMetaData().getDatabaseProductName());
    }
}
