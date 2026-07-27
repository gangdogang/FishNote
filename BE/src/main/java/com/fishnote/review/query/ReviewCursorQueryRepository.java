package com.fishnote.review.query;

import com.fishnote.review.dto.ReviewResponse;
import com.fishnote.review.dto.ReviewSummaryResponse;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class ReviewCursorQueryRepository {

    private static final String LIVE_STAT_JOIN = """
            LEFT JOIN (
                SELECT r.fish_id,
                       count(*) AS review_count,
                       count(r.rating) AS rating_count,
                       coalesce(sum(r.rating), 0) AS rating_sum,
                       count(CASE WHEN r.rating = 1 THEN 1 END) AS rating_1_count,
                       count(CASE WHEN r.rating = 2 THEN 1 END) AS rating_2_count,
                       count(CASE WHEN r.rating = 3 THEN 1 END) AS rating_3_count,
                       count(CASE WHEN r.rating = 4 THEN 1 END) AS rating_4_count,
                       count(CASE WHEN r.rating = 5 THEN 1 END) AS rating_5_count
                FROM review r
                GROUP BY r.fish_id
            ) rs ON rs.fish_id = f.id
            """;

    private final NamedParameterJdbcTemplate jdbc;
    private final boolean readModelEnabled;

    public ReviewCursorQueryRepository(
            NamedParameterJdbcTemplate jdbc,
            @Value("${app.read-model.review-stat.enabled:true}") boolean readModelEnabled) {
        this.jdbc = jdbc;
        this.readModelEnabled = readModelEnabled;
    }

    /** One statement which both verifies the fish and reads its aggregate summary. */
    public Optional<ReviewSummaryResponse> findSummary(Long fishId) {
        String sql = """
                SELECT f.id,
                       coalesce(rs.review_count, 0) AS review_count,
                       coalesce(rs.rating_count, 0) AS rating_count,
                       coalesce(rs.rating_sum, 0) AS rating_sum,
                       coalesce(rs.rating_1_count, 0) AS rating_1_count,
                       coalesce(rs.rating_2_count, 0) AS rating_2_count,
                       coalesce(rs.rating_3_count, 0) AS rating_3_count,
                       coalesce(rs.rating_4_count, 0) AS rating_4_count,
                       coalesce(rs.rating_5_count, 0) AS rating_5_count
                FROM fish f
                %s
                WHERE f.id = :fishId
                """.formatted(statJoin());
        return jdbc.query(
                        sql,
                        new MapSqlParameterSource("fishId", fishId),
                        (resultSet, rowNumber) -> mapSummary(resultSet))
                .stream()
                .findFirst();
    }

    /** One statement, including the limit+1 sentinel used to produce pageInfo. */
    public ReviewSlice findPage(
            Long fishId,
            String sort,
            int limit,
            ReviewCursor cursor,
            Long userId) {
        MapSqlParameterSource parameters = new MapSqlParameterSource()
                .addValue("fishId", fishId)
                .addValue("fetchLimit", limit + 1);
        String cursorPredicate = cursorPredicate(sort, cursor, parameters);
        String orderBy = "latest".equals(sort)
                ? "r.created_at DESC, r.id DESC"
                : "r.helpful_count DESC, r.created_at DESC, r.id DESC";
        String sql = """
                SELECT r.id,
                       r.fish_id,
                       r.user_id,
                       r.nickname,
                       r.rating,
                       r.content,
                       r.image_url,
                       r.helpful_count,
                       r.created_at
                FROM review r
                WHERE r.fish_id = :fishId%s
                ORDER BY %s
                LIMIT :fetchLimit
                """.formatted(cursorPredicate, orderBy);
        List<ReviewRow> rows = jdbc.query(sql, parameters, this::mapReviewRow);
        boolean hasNext = rows.size() > limit;
        if (hasNext) {
            rows = new ArrayList<>(rows.subList(0, limit));
        }
        List<ReviewResponse> items = rows.stream()
                .map(row -> row.toResponse(userId))
                .toList();
        ReviewRow last = rows.isEmpty() ? null : rows.get(rows.size() - 1);
        return new ReviewSlice(
                items,
                hasNext,
                last == null ? null : last.helpfulCount(),
                last == null ? null : last.createdAt(),
                last == null ? null : last.id());
    }

    private String cursorPredicate(
            String sort,
            ReviewCursor cursor,
            MapSqlParameterSource parameters) {
        if (cursor == null) {
            return "";
        }
        parameters.addValue("cursorCreatedAt", cursor.createdAt());
        parameters.addValue("cursorId", cursor.id());
        if ("latest".equals(sort)) {
            return """
                     AND (r.created_at < :cursorCreatedAt
                          OR (r.created_at = :cursorCreatedAt AND r.id < :cursorId))
                    """;
        }
        parameters.addValue("cursorHelpfulCount", cursor.helpfulCount());
        return """
                 AND (r.helpful_count < :cursorHelpfulCount
                      OR (r.helpful_count = :cursorHelpfulCount AND r.created_at < :cursorCreatedAt)
                      OR (r.helpful_count = :cursorHelpfulCount AND r.created_at = :cursorCreatedAt
                          AND r.id < :cursorId))
                """;
    }

    private ReviewSummaryResponse mapSummary(ResultSet resultSet) throws SQLException {
        long ratingCount = resultSet.getLong("rating_count");
        long ratingSum = resultSet.getLong("rating_sum");
        Double average = ratingCount == 0
                ? null
                : Math.round((double) ratingSum / ratingCount * 10.0) / 10.0;
        Map<String, Long> distribution = new LinkedHashMap<>();
        distribution.put("5", resultSet.getLong("rating_5_count"));
        distribution.put("4", resultSet.getLong("rating_4_count"));
        distribution.put("3", resultSet.getLong("rating_3_count"));
        distribution.put("2", resultSet.getLong("rating_2_count"));
        distribution.put("1", resultSet.getLong("rating_1_count"));
        return new ReviewSummaryResponse(
                average,
                resultSet.getLong("review_count"),
                ratingCount,
                distribution);
    }

    private ReviewRow mapReviewRow(ResultSet resultSet, int rowNumber) throws SQLException {
        return new ReviewRow(
                resultSet.getLong("id"),
                resultSet.getLong("fish_id"),
                nullableLong(resultSet, "user_id"),
                resultSet.getString("nickname"),
                nullableShort(resultSet, "rating"),
                resultSet.getString("content"),
                resultSet.getString("image_url"),
                resultSet.getInt("helpful_count"),
                offsetDateTime(resultSet, "created_at"));
    }

    private OffsetDateTime offsetDateTime(ResultSet resultSet, String column) throws SQLException {
        try {
            OffsetDateTime value = resultSet.getObject(column, OffsetDateTime.class);
            if (value != null) {
                return value;
            }
        } catch (SQLException | RuntimeException ignored) {
            // Some H2/JDBC combinations expose TIMESTAMPTZ as Timestamp instead.
        }
        Timestamp timestamp = resultSet.getTimestamp(column);
        return timestamp == null ? null : timestamp.toInstant().atOffset(ZoneOffset.UTC);
    }

    private String statJoin() {
        return readModelEnabled
                ? "LEFT JOIN fish_review_stat rs ON rs.fish_id = f.id\n"
                : LIVE_STAT_JOIN;
    }

    private Long nullableLong(ResultSet resultSet, String column) throws SQLException {
        long value = resultSet.getLong(column);
        return resultSet.wasNull() ? null : value;
    }

    private Short nullableShort(ResultSet resultSet, String column) throws SQLException {
        short value = resultSet.getShort(column);
        return resultSet.wasNull() ? null : value;
    }

    private record ReviewRow(
            Long id,
            Long fishId,
            Long userId,
            String nickname,
            Short rating,
            String content,
            String imageUrl,
            int helpfulCount,
            OffsetDateTime createdAt
    ) {
        private ReviewResponse toResponse(Long currentUserId) {
            return new ReviewResponse(
                    id,
                    fishId,
                    nickname,
                    rating,
                    content,
                    imageUrl,
                    helpfulCount,
                    createdAt,
                    currentUserId != null && currentUserId.equals(userId));
        }
    }
}
