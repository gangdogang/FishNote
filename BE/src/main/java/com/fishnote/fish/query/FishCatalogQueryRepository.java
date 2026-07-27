package com.fishnote.fish.query;

import com.fishnote.fish.FishCategory;
import com.fishnote.fish.FishImageRole;
import com.fishnote.fish.dto.FishFacetsResponse;
import com.fishnote.fish.dto.FishFocalPointResponse;
import com.fishnote.fish.dto.FishMediaResponse;
import com.fishnote.fish.dto.FishSummaryResponse;
import java.math.BigDecimal;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.jdbc.core.RowCallbackHandler;
import org.springframework.stereotype.Repository;
import org.springframework.util.StringUtils;

@Repository
public class FishCatalogQueryRepository {

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

    private static final String READ_MODEL_STAT_JOIN =
            "LEFT JOIN fish_review_stat rs ON rs.fish_id = f.id\n";

    private static final String AVG_EXPRESSION = """
            CASE WHEN coalesce(rs.rating_count, 0) = 0 THEN 0
                 ELSE (1.0 * rs.rating_sum / rs.rating_count) END
            """;

    private final NamedParameterJdbcTemplate jdbc;
    private final boolean readModelEnabled;

    public FishCatalogQueryRepository(
            NamedParameterJdbcTemplate jdbc,
            @Value("${app.read-model.review-stat.enabled:true}") boolean readModelEnabled) {
        this.jdbc = jdbc;
        this.readModelEnabled = readModelEnabled;
    }

    /**
     * Reads a user's bookmarked summaries in three statements including the caller's user check.
     * Scalar/rating/media data is one statement and both plural collections share one UNION query.
     */
    public List<FishSummaryResponse> findBookmarks(Long userId) {
        MapSqlParameterSource parameters = new MapSqlParameterSource("userId", userId);
        String sql = """
                SELECT f.id,
                       f.slug,
                       f.category,
                       f.name,
                       f.image_url,
                       f.description,
                       f.price_level,
                       f.featured,
                       coalesce(rs.review_count, 0) AS review_count,
                       coalesce(rs.rating_count, 0) AS rating_count,
                       coalesce(rs.rating_sum, 0) AS rating_sum,
                       %s AS avg_rating,
                       fi.id AS media_id,
                       fi.url AS media_url,
                       fi.width AS media_width,
                       fi.height AS media_height,
                       fi.alt AS media_alt,
                       fi.role AS media_role,
                       fi.credit AS media_credit,
                       fi.source_url AS media_source_url,
                       fi.license AS media_license,
                       fi.focal_x AS media_focal_x,
                       fi.focal_y AS media_focal_y,
                       fi.blur_data_url AS media_blur_data_url
                FROM user_bookmark bookmark
                JOIN fish f ON f.id = bookmark.fish_id
                %s
                LEFT JOIN fish_image fi
                  ON fi.fish_id = f.id
                 AND fi.role = 'PRIMARY'
                 AND fi.width IS NOT NULL
                 AND fi.height IS NOT NULL
                 AND fi.alt IS NOT NULL
                WHERE bookmark.user_id = :userId
                ORDER BY bookmark.created_at ASC, bookmark.fish_id ASC
                """.formatted(AVG_EXPRESSION, statJoin("f"));

        List<CatalogRow> rows = jdbc.query(sql, parameters, this::mapCatalogRow);
        if (rows.isEmpty()) {
            return List.of();
        }

        CollectionRows collections = findCollections(rows.stream().map(CatalogRow::id).toList());
        return rows.stream()
                .map(row -> row.toResponse(
                        collections.tastes().getOrDefault(row.id(), List.of()),
                        collections.seasons().getOrDefault(row.id(), List.of())))
                .toList();
    }

    public FishCatalogSlice findPage(FishCatalogQuery query) {
        MapSqlParameterSource parameters = new MapSqlParameterSource();
        String baseFilter = filterSql(query, parameters);
        String cursorFilter = cursorSql(query, parameters);
        parameters.addValue("fetchLimit", query.limit() + 1);

        String sql = """
                SELECT f.id,
                       f.slug,
                       f.category,
                       f.name,
                       f.image_url,
                       f.description,
                       f.price_level,
                       f.featured,
                       coalesce(rs.review_count, 0) AS review_count,
                       coalesce(rs.rating_count, 0) AS rating_count,
                       coalesce(rs.rating_sum, 0) AS rating_sum,
                       %s AS avg_rating,
                       fi.id AS media_id,
                       fi.url AS media_url,
                       fi.width AS media_width,
                       fi.height AS media_height,
                       fi.alt AS media_alt,
                       fi.role AS media_role,
                       fi.credit AS media_credit,
                       fi.source_url AS media_source_url,
                       fi.license AS media_license,
                       fi.focal_x AS media_focal_x,
                       fi.focal_y AS media_focal_y,
                       fi.blur_data_url AS media_blur_data_url
                FROM fish f
                %s
                LEFT JOIN fish_image fi
                  ON fi.fish_id = f.id
                 AND fi.role = 'PRIMARY'
                 AND fi.width IS NOT NULL
                 AND fi.height IS NOT NULL
                 AND fi.alt IS NOT NULL
                WHERE %s%s
                ORDER BY %s
                LIMIT :fetchLimit
                """.formatted(
                AVG_EXPRESSION,
                statJoin("f"),
                baseFilter,
                cursorFilter,
                orderBy(query.sort()));

        List<CatalogRow> rows = jdbc.query(sql, parameters, this::mapCatalogRow);
        boolean hasNext = rows.size() > query.limit();
        if (hasNext) {
            rows = new ArrayList<>(rows.subList(0, query.limit()));
        }

        List<Long> fishIds = rows.stream().map(CatalogRow::id).toList();
        Map<Long, List<Short>> seasons = findSeasons(fishIds);
        Map<Long, List<String>> tastes = findTastes(fishIds);
        List<FishSummaryResponse> items = rows.stream()
                .map(row -> row.toResponse(
                        tastes.getOrDefault(row.id(), List.of()),
                        seasons.getOrDefault(row.id(), List.of())))
                .toList();
        FishFacetsResponse facets = findFacets(baseFilter, parameters);

        CatalogRow last = rows.isEmpty() ? null : rows.get(rows.size() - 1);
        return new FishCatalogSlice(
                items,
                facets,
                hasNext,
                last == null ? null : last.reviewCount(),
                last == null ? null : last.avgRating(),
                last == null ? null : last.name(),
                last == null ? null : last.id());
    }

    private Map<Long, List<Short>> findSeasons(Collection<Long> fishIds) {
        if (fishIds.isEmpty()) {
            return Map.of();
        }
        MapSqlParameterSource parameters = new MapSqlParameterSource("ids", fishIds);
        Map<Long, List<Short>> seasons = new LinkedHashMap<>();
        jdbc.query(
                """
                SELECT fish_id, month
                FROM fish_season_month
                WHERE fish_id IN (:ids)
                ORDER BY fish_id, month
                """,
                parameters,
                (RowCallbackHandler) resultSet -> seasons
                        .computeIfAbsent(resultSet.getLong("fish_id"), ignored -> new ArrayList<>())
                        .add(resultSet.getShort("month")));
        return seasons;
    }

    private Map<Long, List<String>> findTastes(Collection<Long> fishIds) {
        if (fishIds.isEmpty()) {
            return Map.of();
        }
        MapSqlParameterSource parameters = new MapSqlParameterSource("ids", fishIds);
        Map<Long, List<String>> tastes = new LinkedHashMap<>();
        jdbc.query(
                """
                SELECT fish_id, tag
                FROM fish_taste_tag
                WHERE fish_id IN (:ids)
                ORDER BY fish_id, tag
                """,
                parameters,
                (RowCallbackHandler) resultSet -> tastes
                        .computeIfAbsent(resultSet.getLong("fish_id"), ignored -> new ArrayList<>())
                        .add(resultSet.getString("tag")));
        return tastes;
    }

    private CollectionRows findCollections(Collection<Long> fishIds) {
        if (fishIds.isEmpty()) {
            return new CollectionRows(Map.of(), Map.of());
        }
        MapSqlParameterSource parameters = new MapSqlParameterSource("ids", fishIds);
        Map<Long, List<Short>> seasons = new LinkedHashMap<>();
        Map<Long, List<String>> tastes = new LinkedHashMap<>();
        jdbc.query(
                """
                SELECT fish_id, collection_type, collection_value
                FROM (
                    SELECT fish_id,
                           'season' AS collection_type,
                           CAST(month AS VARCHAR) AS collection_value
                    FROM fish_season_month
                    WHERE fish_id IN (:ids)

                    UNION ALL

                    SELECT fish_id,
                           'taste' AS collection_type,
                           tag AS collection_value
                    FROM fish_taste_tag
                    WHERE fish_id IN (:ids)
                ) collections
                ORDER BY fish_id, collection_type, collection_value
                """,
                parameters,
                (RowCallbackHandler) resultSet -> {
                    long fishId = resultSet.getLong("fish_id");
                    String value = resultSet.getString("collection_value");
                    if ("season".equals(resultSet.getString("collection_type"))) {
                        seasons.computeIfAbsent(fishId, ignored -> new ArrayList<>())
                                .add(Short.parseShort(value));
                    } else {
                        tastes.computeIfAbsent(fishId, ignored -> new ArrayList<>()).add(value);
                    }
                });
        seasons.replaceAll((ignored, values) -> values.stream().sorted().toList());
        tastes.replaceAll((ignored, values) -> values.stream().sorted().toList());
        return new CollectionRows(seasons, tastes);
    }

    private FishFacetsResponse findFacets(String baseFilter, MapSqlParameterSource parameters) {
        String sql = """
                SELECT facet, facet_value, facet_count
                FROM (
                    SELECT 'taste' AS facet,
                           tt.tag AS facet_value,
                           count(DISTINCT f.id) AS facet_count
                    FROM fish f
                    JOIN fish_taste_tag tt ON tt.fish_id = f.id
                    WHERE %1$s
                    GROUP BY tt.tag

                    UNION ALL

                    SELECT 'season' AS facet,
                           CASE
                               WHEN sm.month IN (3, 4, 5) THEN 'spring'
                               WHEN sm.month IN (6, 7, 8) THEN 'summer'
                               WHEN sm.month IN (9, 10, 11) THEN 'fall'
                               ELSE 'winter'
                           END AS facet_value,
                           count(DISTINCT f.id) AS facet_count
                    FROM fish f
                    JOIN fish_season_month sm ON sm.fish_id = f.id
                    WHERE %1$s
                    GROUP BY CASE
                               WHEN sm.month IN (3, 4, 5) THEN 'spring'
                               WHEN sm.month IN (6, 7, 8) THEN 'summer'
                               WHEN sm.month IN (9, 10, 11) THEN 'fall'
                               ELSE 'winter'
                             END

                    UNION ALL

                    SELECT 'priceLevel' AS facet,
                           CAST(f.price_level AS VARCHAR) AS facet_value,
                           count(*) AS facet_count
                    FROM fish f
                    WHERE %1$s AND f.price_level IS NOT NULL
                    GROUP BY f.price_level

                    UNION ALL

                    SELECT 'category' AS facet,
                           CAST(f.category AS VARCHAR) AS facet_value,
                           count(*) AS facet_count
                    FROM fish f
                    WHERE %1$s
                    GROUP BY f.category
                ) facet_rows
                ORDER BY facet, facet_value
                """.formatted(baseFilter);

        Map<String, Long> taste = new LinkedHashMap<>();
        Map<String, Long> season = new LinkedHashMap<>();
        Map<String, Long> priceLevel = new LinkedHashMap<>();
        Map<String, Long> category = new LinkedHashMap<>();
        jdbc.query(sql, parameters, (RowCallbackHandler) resultSet -> {
            Map<String, Long> target = switch (resultSet.getString("facet")) {
                case "taste" -> taste;
                case "season" -> season;
                case "priceLevel" -> priceLevel;
                case "category" -> category;
                default -> throw new IllegalStateException("알 수 없는 facet입니다.");
            };
            target.put(resultSet.getString("facet_value"), resultSet.getLong("facet_count"));
        });
        return new FishFacetsResponse(taste, season, priceLevel, category);
    }

    private CatalogRow mapCatalogRow(ResultSet resultSet, int rowNumber) throws SQLException {
        return new CatalogRow(
                resultSet.getLong("id"),
                resultSet.getString("slug"),
                FishCategory.valueOf(resultSet.getString("category")),
                resultSet.getString("name"),
                media(resultSet),
                resultSet.getString("image_url"),
                resultSet.getString("description"),
                nullableShort(resultSet, "price_level"),
                resultSet.getBoolean("featured"),
                resultSet.getBigDecimal("avg_rating"),
                resultSet.getLong("review_count"),
                resultSet.getLong("rating_count"));
    }

    private FishMediaResponse media(ResultSet resultSet) throws SQLException {
        Long id = nullableLong(resultSet, "media_id");
        if (id == null) {
            return null;
        }
        BigDecimal focalX = resultSet.getBigDecimal("media_focal_x");
        BigDecimal focalY = resultSet.getBigDecimal("media_focal_y");
        FishFocalPointResponse focalPoint = focalX == null || focalY == null
                ? null
                : new FishFocalPointResponse(focalX.doubleValue(), focalY.doubleValue());
        return new FishMediaResponse(
                id.toString(),
                resultSet.getString("media_url"),
                resultSet.getInt("media_width"),
                resultSet.getInt("media_height"),
                resultSet.getString("media_alt"),
                FishImageRole.valueOf(resultSet.getString("media_role")),
                resultSet.getString("media_credit"),
                resultSet.getString("media_source_url"),
                resultSet.getString("media_license"),
                focalPoint,
                resultSet.getString("media_blur_data_url"));
    }

    private String filterSql(FishCatalogQuery query, MapSqlParameterSource parameters) {
        List<String> filters = new ArrayList<>();
        if (StringUtils.hasText(query.search())) {
            String normalized = query.search().trim().toLowerCase(Locale.ROOT);
            parameters.addValue("search", "%" + escapeLike(normalized) + "%");
            parameters.addValue("compactSearch", "%" + escapeLike(normalized.replaceAll("\\s+", "")) + "%");
            filters.add("""
                    (lower(f.name) LIKE :search ESCAPE '\\'
                     OR lower(coalesce(f.name_en, '')) LIKE :search ESCAPE '\\'
                     OR EXISTS (
                         SELECT 1 FROM fish_alias fa
                         WHERE fa.fish_id = f.id
                           AND lower(fa.alias) LIKE :compactSearch ESCAPE '\\'
                     ))
                    """);
        }
        if (query.seasonMonths() != null) {
            parameters.addValue("seasonMonths", query.seasonMonths());
            filters.add("EXISTS (SELECT 1 FROM fish_season_month smf WHERE smf.fish_id = f.id AND smf.month IN (:seasonMonths))");
        }
        if (StringUtils.hasText(query.taste())) {
            parameters.addValue("taste", query.taste());
            filters.add("EXISTS (SELECT 1 FROM fish_taste_tag ttf WHERE ttf.fish_id = f.id AND ttf.tag = :taste)");
        }
        if (query.priceLevel() != null) {
            parameters.addValue("priceLevel", query.priceLevel());
            filters.add("f.price_level = :priceLevel");
        }
        if (query.month() != null) {
            parameters.addValue("month", query.month());
            filters.add("EXISTS (SELECT 1 FROM fish_season_month mm WHERE mm.fish_id = f.id AND mm.month = :month)");
        }
        if (query.featured() != null) {
            parameters.addValue("featured", query.featured());
            filters.add("f.featured = :featured");
        }
        if (query.category() != null) {
            parameters.addValue("category", query.category().name());
            filters.add("f.category = :category");
        }
        return filters.isEmpty() ? "1 = 1" : String.join(" AND ", filters);
    }

    private String cursorSql(FishCatalogQuery query, MapSqlParameterSource parameters) {
        FishCatalogCursor cursor = query.cursor();
        if (cursor == null) {
            return "";
        }
        parameters.addValue("cursorName", cursor.name());
        parameters.addValue("cursorId", cursor.id());
        if ("name".equals(query.sort())) {
            return " AND (f.name > :cursorName OR (f.name = :cursorName AND f.id > :cursorId))";
        }
        parameters.addValue("cursorReviewCount", cursor.reviewCount());
        parameters.addValue("cursorAvgRating", cursor.avgRating());
        return """
                 AND (
                    coalesce(rs.review_count, 0) < :cursorReviewCount
                    OR (coalesce(rs.review_count, 0) = :cursorReviewCount AND %1$s < :cursorAvgRating)
                    OR (coalesce(rs.review_count, 0) = :cursorReviewCount AND %1$s = :cursorAvgRating
                        AND f.name > :cursorName)
                    OR (coalesce(rs.review_count, 0) = :cursorReviewCount AND %1$s = :cursorAvgRating
                        AND f.name = :cursorName AND f.id > :cursorId)
                 )
                """.formatted(AVG_EXPRESSION);
    }

    private String statJoin(String fishAlias) {
        return readModelEnabled
                ? READ_MODEL_STAT_JOIN.replace("f.id", fishAlias + ".id")
                : LIVE_STAT_JOIN.replace("f.id", fishAlias + ".id");
    }

    private String orderBy(String sort) {
        if ("name".equals(sort)) {
            return "f.name ASC, f.id ASC";
        }
        return "coalesce(rs.review_count, 0) DESC, " + AVG_EXPRESSION
                + " DESC, f.name ASC, f.id ASC";
    }

    private String escapeLike(String value) {
        return value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
    }

    private Long nullableLong(ResultSet resultSet, String column) throws SQLException {
        long value = resultSet.getLong(column);
        return resultSet.wasNull() ? null : value;
    }

    private Short nullableShort(ResultSet resultSet, String column) throws SQLException {
        short value = resultSet.getShort(column);
        return resultSet.wasNull() ? null : value;
    }

    private record CatalogRow(
            Long id,
            String slug,
            FishCategory category,
            String name,
            FishMediaResponse media,
            String imageUrl,
            String description,
            Short priceLevel,
            boolean featured,
            BigDecimal avgRating,
            long reviewCount,
            long ratingCount
    ) {
        private FishSummaryResponse toResponse(List<String> tasteTags, List<Short> seasonMonths) {
            double roundedAverage = avgRating == null
                    ? 0.0
                    : Math.round(avgRating.doubleValue() * 10.0) / 10.0;
            return new FishSummaryResponse(
                    id,
                    slug,
                    category,
                    name,
                    media,
                    imageUrl,
                    description,
                    priceLevel,
                    tasteTags,
                    seasonMonths,
                    featured,
                    roundedAverage,
                    reviewCount,
                    ratingCount);
        }
    }

    private record CollectionRows(
            Map<Long, List<Short>> seasons,
            Map<Long, List<String>> tastes) {
    }
}
