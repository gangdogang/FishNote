package com.fishnote.fish.query;

import com.fishnote.fish.FishCategory;
import com.fishnote.fish.FishImageRole;
import com.fishnote.fish.dto.FishDetailResponse;
import com.fishnote.fish.dto.FishFocalPointResponse;
import com.fishnote.fish.dto.FishMediaResponse;
import com.fishnote.fish.dto.SimilarFishResponse;
import java.math.BigDecimal;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.jdbc.core.RowCallbackHandler;
import org.springframework.stereotype.Repository;

@Repository
public class FishDetailQueryRepository {

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
            ) rs ON rs.fish_id = %s.id
            """;

    private final NamedParameterJdbcTemplate jdbc;
    private final boolean readModelEnabled;

    public FishDetailQueryRepository(
            NamedParameterJdbcTemplate jdbc,
            @Value("${app.read-model.review-stat.enabled:true}") boolean readModelEnabled) {
        this.jdbc = jdbc;
        this.readModelEnabled = readModelEnabled;
    }

    /**
     * Executes exactly three statements for an existing fish: scalar/stat, all owned collections,
     * and similar summaries. No plural association is join-fetched with another plural association.
     */
    public Optional<FishDetailResponse> findDetail(String identifier) {
        MapSqlParameterSource parameters = identifierParameters(identifier);
        String identifierPredicate = parameters.hasValue("id") ? "f.id = :id" : "f.slug = :slug";
        String scalarSql = """
                SELECT f.id,
                       f.slug,
                       f.category,
                       f.name,
                       f.name_en,
                       f.scientific_name,
                       f.image_url,
                       f.description,
                       f.taste_desc,
                       f.price_level,
                       coalesce(rs.review_count, 0) AS review_count,
                       coalesce(rs.rating_count, 0) AS rating_count,
                       coalesce(rs.rating_sum, 0) AS rating_sum,
                       coalesce(rs.rating_1_count, 0) AS rating_1_count,
                       coalesce(rs.rating_2_count, 0) AS rating_2_count,
                       coalesce(rs.rating_3_count, 0) AS rating_3_count,
                       coalesce(rs.rating_4_count, 0) AS rating_4_count,
                       coalesce(rs.rating_5_count, 0) AS rating_5_count,
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
                WHERE %s
                """.formatted(statJoin("f"), identifierPredicate);
        List<DetailScalar> scalarRows = jdbc.query(scalarSql, parameters, this::mapScalar);
        if (scalarRows.isEmpty()) {
            return Optional.empty();
        }

        DetailScalar scalar = scalarRows.get(0);
        DetailCollections collections = findCollections(scalar.id());
        List<SimilarFishResponse> similar = findSimilar(scalar.id());
        return Optional.of(scalar.toResponse(collections, similar));
    }

    private DetailCollections findCollections(Long fishId) {
        MapSqlParameterSource parameters = new MapSqlParameterSource("fishId", fishId);
        String sql = """
                SELECT kind, sort_order, item_value,
                       media_id, media_url, media_width, media_height, media_alt, media_role,
                       media_credit, media_source_url, media_license, media_focal_x, media_focal_y,
                       media_blur_data_url
                FROM (
                    SELECT 'ALIAS' AS kind, a.id AS sort_order, a.alias AS item_value,
                           CAST(NULL AS BIGINT) AS media_id, CAST(NULL AS VARCHAR) AS media_url,
                           CAST(NULL AS INTEGER) AS media_width, CAST(NULL AS INTEGER) AS media_height,
                           CAST(NULL AS VARCHAR) AS media_alt, CAST(NULL AS VARCHAR) AS media_role,
                           CAST(NULL AS VARCHAR) AS media_credit, CAST(NULL AS VARCHAR) AS media_source_url,
                           CAST(NULL AS VARCHAR) AS media_license, CAST(NULL AS DECIMAL(5,4)) AS media_focal_x,
                           CAST(NULL AS DECIMAL(5,4)) AS media_focal_y,
                           CAST(NULL AS VARCHAR) AS media_blur_data_url
                    FROM fish_alias a WHERE a.fish_id = :fishId

                    UNION ALL

                    SELECT 'SEASON', sm.month, CAST(sm.month AS VARCHAR),
                           CAST(NULL AS BIGINT), CAST(NULL AS VARCHAR), CAST(NULL AS INTEGER),
                           CAST(NULL AS INTEGER), CAST(NULL AS VARCHAR), CAST(NULL AS VARCHAR),
                           CAST(NULL AS VARCHAR), CAST(NULL AS VARCHAR), CAST(NULL AS VARCHAR),
                           CAST(NULL AS DECIMAL(5,4)), CAST(NULL AS DECIMAL(5,4)), CAST(NULL AS VARCHAR)
                    FROM fish_season_month sm WHERE sm.fish_id = :fishId

                    UNION ALL

                    SELECT 'TASTE', 0, tt.tag,
                           CAST(NULL AS BIGINT), CAST(NULL AS VARCHAR), CAST(NULL AS INTEGER),
                           CAST(NULL AS INTEGER), CAST(NULL AS VARCHAR), CAST(NULL AS VARCHAR),
                           CAST(NULL AS VARCHAR), CAST(NULL AS VARCHAR), CAST(NULL AS VARCHAR),
                           CAST(NULL AS DECIMAL(5,4)), CAST(NULL AS DECIMAL(5,4)), CAST(NULL AS VARCHAR)
                    FROM fish_taste_tag tt WHERE tt.fish_id = :fishId

                    UNION ALL

                    SELECT 'TIP', ft.tip_order, ft.content,
                           CAST(NULL AS BIGINT), CAST(NULL AS VARCHAR), CAST(NULL AS INTEGER),
                           CAST(NULL AS INTEGER), CAST(NULL AS VARCHAR), CAST(NULL AS VARCHAR),
                           CAST(NULL AS VARCHAR), CAST(NULL AS VARCHAR), CAST(NULL AS VARCHAR),
                           CAST(NULL AS DECIMAL(5,4)), CAST(NULL AS DECIMAL(5,4)), CAST(NULL AS VARCHAR)
                    FROM fish_tip ft WHERE ft.fish_id = :fishId

                    UNION ALL

                    SELECT 'IMAGE', fi.image_order, fi.url,
                           fi.id, fi.url, fi.width, fi.height, fi.alt, fi.role,
                           fi.credit, fi.source_url, fi.license, fi.focal_x, fi.focal_y,
                           fi.blur_data_url
                    FROM fish_image fi WHERE fi.fish_id = :fishId
                ) collection_rows
                ORDER BY kind, sort_order, item_value
                """;

        DetailCollections result = new DetailCollections();
        jdbc.query(sql, parameters, (RowCallbackHandler) resultSet -> {
            switch (resultSet.getString("kind")) {
                case "ALIAS" -> result.aliases.add(resultSet.getString("item_value"));
                case "SEASON" -> result.seasonMonths.add(Short.valueOf(resultSet.getString("item_value")));
                case "TASTE" -> result.tasteTags.add(resultSet.getString("item_value"));
                case "TIP" -> result.tips.add(resultSet.getString("item_value"));
                case "IMAGE" -> {
                    result.imageUrls.add(resultSet.getString("media_url"));
                    FishMediaResponse media = media(resultSet);
                    if (media != null && media.role() == FishImageRole.GALLERY) {
                        result.galleryMedia.add(media);
                    }
                }
                default -> throw new IllegalStateException("알 수 없는 detail collection입니다.");
            }
        });
        result.aliases.sort(String::compareTo);
        result.seasonMonths.sort(Short::compareTo);
        result.tasteTags.sort(String::compareTo);
        return result;
    }

    private List<SimilarFishResponse> findSimilar(Long fishId) {
        MapSqlParameterSource parameters = new MapSqlParameterSource("fishId", fishId);
        String sql = """
                SELECT sf.id,
                       sf.slug,
                       sf.name,
                       sf.image_url,
                       sf.price_level,
                       coalesce(rs.rating_count, 0) AS rating_count,
                       coalesce(rs.rating_sum, 0) AS rating_sum,
                       sm.month AS season_month,
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
                FROM fish_similar fs
                JOIN fish sf ON sf.id = fs.similar_fish_id
                %s
                LEFT JOIN fish_season_month sm ON sm.fish_id = sf.id
                LEFT JOIN fish_image fi
                  ON fi.fish_id = sf.id
                 AND fi.role = 'PRIMARY'
                 AND fi.width IS NOT NULL
                 AND fi.height IS NOT NULL
                 AND fi.alt IS NOT NULL
                WHERE fs.fish_id = :fishId
                ORDER BY sf.name, sf.id, sm.month
                """.formatted(statJoin("sf"));

        Map<Long, SimilarAccumulator> grouped = new LinkedHashMap<>();
        jdbc.query(sql, parameters, (RowCallbackHandler) resultSet -> {
            Long id = resultSet.getLong("id");
            SimilarAccumulator item = grouped.computeIfAbsent(id, ignored -> {
                try {
                    long ratingCount = resultSet.getLong("rating_count");
                    long ratingSum = resultSet.getLong("rating_sum");
                    return new SimilarAccumulator(
                            id,
                            resultSet.getString("slug"),
                            resultSet.getString("name"),
                            media(resultSet),
                            resultSet.getString("image_url"),
                            nullableShort(resultSet, "price_level"),
                            ratingCount == 0 ? 0.0 : roundedAverage(ratingSum, ratingCount),
                            ratingCount);
                } catch (SQLException ex) {
                    throw new IllegalStateException("similar fish row를 읽을 수 없습니다.", ex);
                }
            });
            Short month = nullableShort(resultSet, "season_month");
            if (month != null) {
                item.seasonMonths.add(month);
            }
        });
        return grouped.values().stream()
                .map(SimilarAccumulator::toResponse)
                .sorted(Comparator.comparing(SimilarFishResponse::name))
                .toList();
    }

    private DetailScalar mapScalar(ResultSet resultSet, int rowNumber) throws SQLException {
        return new DetailScalar(
                resultSet.getLong("id"),
                resultSet.getString("slug"),
                FishCategory.valueOf(resultSet.getString("category")),
                resultSet.getString("name"),
                resultSet.getString("name_en"),
                resultSet.getString("scientific_name"),
                media(resultSet),
                resultSet.getString("image_url"),
                resultSet.getString("description"),
                resultSet.getString("taste_desc"),
                nullableShort(resultSet, "price_level"),
                resultSet.getLong("review_count"),
                resultSet.getLong("rating_count"),
                resultSet.getLong("rating_sum"),
                resultSet.getLong("rating_1_count"),
                resultSet.getLong("rating_2_count"),
                resultSet.getLong("rating_3_count"),
                resultSet.getLong("rating_4_count"),
                resultSet.getLong("rating_5_count"));
    }

    private MapSqlParameterSource identifierParameters(String identifier) {
        MapSqlParameterSource parameters = new MapSqlParameterSource();
        if (identifier != null && identifier.matches("\\d+")) {
            try {
                return parameters.addValue("id", Long.parseLong(identifier));
            } catch (NumberFormatException ignored) {
                return parameters.addValue("id", -1L);
            }
        }
        return parameters.addValue("slug", identifier);
    }

    private String statJoin(String fishAlias) {
        return readModelEnabled
                ? "LEFT JOIN fish_review_stat rs ON rs.fish_id = " + fishAlias + ".id\n"
                : LIVE_STAT_JOIN.formatted(fishAlias);
    }

    private FishMediaResponse media(ResultSet resultSet) throws SQLException {
        Long id = nullableLong(resultSet, "media_id");
        Integer width = nullableInteger(resultSet, "media_width");
        Integer height = nullableInteger(resultSet, "media_height");
        String alt = resultSet.getString("media_alt");
        String role = resultSet.getString("media_role");
        if (id == null || width == null || height == null || alt == null || role == null) {
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
                width,
                height,
                alt,
                FishImageRole.valueOf(role),
                resultSet.getString("media_credit"),
                resultSet.getString("media_source_url"),
                resultSet.getString("media_license"),
                focalPoint,
                resultSet.getString("media_blur_data_url"));
    }

    private Long nullableLong(ResultSet resultSet, String column) throws SQLException {
        long value = resultSet.getLong(column);
        return resultSet.wasNull() ? null : value;
    }

    private Integer nullableInteger(ResultSet resultSet, String column) throws SQLException {
        int value = resultSet.getInt(column);
        return resultSet.wasNull() ? null : value;
    }

    private Short nullableShort(ResultSet resultSet, String column) throws SQLException {
        short value = resultSet.getShort(column);
        return resultSet.wasNull() ? null : value;
    }

    private double roundedAverage(long ratingSum, long ratingCount) {
        return Math.round((double) ratingSum / ratingCount * 10.0) / 10.0;
    }

    private static final class DetailCollections {
        private final List<String> aliases = new ArrayList<>();
        private final List<Short> seasonMonths = new ArrayList<>();
        private final List<String> tasteTags = new ArrayList<>();
        private final List<String> tips = new ArrayList<>();
        private final List<String> imageUrls = new ArrayList<>();
        private final List<FishMediaResponse> galleryMedia = new ArrayList<>();
    }

    private record DetailScalar(
            Long id,
            String slug,
            FishCategory category,
            String name,
            String nameEn,
            String scientificName,
            FishMediaResponse media,
            String imageUrl,
            String description,
            String tasteDesc,
            Short priceLevel,
            long reviewCount,
            long ratingCount,
            long ratingSum,
            long rating1Count,
            long rating2Count,
            long rating3Count,
            long rating4Count,
            long rating5Count
    ) {
        private FishDetailResponse toResponse(
                DetailCollections collections,
                List<SimilarFishResponse> similar) {
            Map<String, Long> distribution = new LinkedHashMap<>();
            distribution.put("5", rating5Count);
            distribution.put("4", rating4Count);
            distribution.put("3", rating3Count);
            distribution.put("2", rating2Count);
            distribution.put("1", rating1Count);
            double average = ratingCount == 0
                    ? 0.0
                    : Math.round((double) ratingSum / ratingCount * 10.0) / 10.0;
            List<String> aliases = collections.aliases.stream()
                    .filter(alias -> !alias.equals(name))
                    .toList();
            List<String> images = collections.imageUrls.isEmpty() && imageUrl != null
                    ? List.of(imageUrl)
                    : List.copyOf(collections.imageUrls);
            return new FishDetailResponse(
                    id,
                    slug,
                    category,
                    name,
                    nameEn,
                    scientificName,
                    aliases,
                    media,
                    imageUrl,
                    images,
                    List.copyOf(collections.galleryMedia),
                    description,
                    tasteDesc,
                    List.copyOf(collections.tasteTags),
                    List.copyOf(collections.seasonMonths),
                    priceLevel,
                    average,
                    reviewCount,
                    ratingCount,
                    distribution,
                    List.copyOf(collections.tips),
                    similar);
        }
    }

    private static final class SimilarAccumulator {
        private final Long id;
        private final String slug;
        private final String name;
        private final FishMediaResponse media;
        private final String imageUrl;
        private final Short priceLevel;
        private final double avgRating;
        private final long ratingCount;
        private final List<Short> seasonMonths = new ArrayList<>();

        private SimilarAccumulator(
                Long id,
                String slug,
                String name,
                FishMediaResponse media,
                String imageUrl,
                Short priceLevel,
                double avgRating,
                long ratingCount) {
            this.id = id;
            this.slug = slug;
            this.name = name;
            this.media = media;
            this.imageUrl = imageUrl;
            this.priceLevel = priceLevel;
            this.avgRating = avgRating;
            this.ratingCount = ratingCount;
        }

        private SimilarFishResponse toResponse() {
            return new SimilarFishResponse(
                    id,
                    slug,
                    name,
                    media,
                    imageUrl,
                    priceLevel,
                    avgRating,
                    ratingCount,
                    seasonMonths.stream().distinct().sorted().toList());
        }
    }
}
