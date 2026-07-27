package com.fishnote.price;

import java.sql.PreparedStatement;
import java.sql.SQLException;
import java.sql.Types;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.jdbc.core.ConnectionCallback;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.ResultSetExtractor;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class PriceImportPersistenceService {

    static final int MAX_INSERT_ROWS = 200;
    static final int MAX_LEGACY_INSERT_ROWS = 50;

    private static final String INSERT_COLUMNS = """
            fish_id, observed_at, source_type, source_name, speaker,
            canonical_fish_name, reported_name, condition, origin, size_grade,
            unit, price_min_krw, price_max_krw, confidence, raw_text, dedup_hash
            """;

    private final JdbcTemplate jdbcTemplate;
    private final NamedParameterJdbcTemplate namedJdbcTemplate;
    private final ApplicationEventPublisher eventPublisher;
    private volatile Boolean supportsOnConflict;

    public PriceImportPersistenceService(
            JdbcTemplate jdbcTemplate,
            NamedParameterJdbcTemplate namedJdbcTemplate,
            ApplicationEventPublisher eventPublisher) {
        this.jdbcTemplate = jdbcTemplate;
        this.namedJdbcTemplate = namedJdbcTemplate;
        this.eventPublisher = eventPublisher;
    }

    @Transactional
    public TelegramPriceImportResponse persist(
            List<ParsedShopPrice> parsedRows,
            List<String> sourceNames,
            String replyChatId) {
        if (parsedRows.size() > MAX_INSERT_ROWS) {
            throw new IllegalArgumentException(
                    "시세는 webhook당 최대 " + MAX_INSERT_ROWS + "건까지 가져올 수 있습니다.");
        }
        return persist(parsedRows, sourceNames, replyChatId, MAX_INSERT_ROWS);
    }

    /**
     * Bounded row-at-a-time fallback for emergency rollback of the bulk importer.
     *
     * <p>The fallback deliberately keeps the same dedup hash and after-commit event contract as the
     * bulk path. It rejects oversized webhook payloads instead of partially importing them.
     */
    @Transactional
    public TelegramPriceImportResponse persistLegacy(
            List<ParsedShopPrice> parsedRows,
            List<String> sourceNames,
            String replyChatId) {
        if (parsedRows.size() > MAX_LEGACY_INSERT_ROWS) {
            throw new IllegalArgumentException(
                    "bulk import 비활성화 중에는 시세를 최대 "
                            + MAX_LEGACY_INSERT_ROWS
                            + "건까지 가져올 수 있습니다.");
        }
        return persist(parsedRows, sourceNames, replyChatId, 1);
    }

    private TelegramPriceImportResponse persist(
            List<ParsedShopPrice> parsedRows,
            List<String> sourceNames,
            String replyChatId,
            int insertChunkSize) {
        List<ParsedShopPrice> rows = List.copyOf(parsedRows);
        rows.forEach(this::validatePriceRange);
        Map<String, Long> fishIdsByName = findCanonicalFishIds(rows);

        int savedCount = 0;
        for (int start = 0; start < rows.size(); start += insertChunkSize) {
            List<ParsedShopPrice> chunk = rows.subList(
                    start, Math.min(start + insertChunkSize, rows.size()));
            savedCount += insertChunk(chunk, fishIdsByName);
        }

        TelegramPriceImportResponse response =
                new TelegramPriceImportResponse(rows.size(), savedCount, List.copyOf(sourceNames));
        Set<Long> touchedFishIds = new LinkedHashSet<>();
        rows.stream()
                .map(ParsedShopPrice::canonicalFishName)
                .map(fishIdsByName::get)
                .filter(java.util.Objects::nonNull)
                .forEach(touchedFishIds::add);

        eventPublisher.publishEvent(new PriceImportCommittedEvent(touchedFishIds, response));
        if (replyChatId != null && !replyChatId.isBlank()) {
            eventPublisher.publishEvent(new TelegramReplyRequested(
                    replyChatId, TelegramPriceReplyText.completed(response)));
        }
        return response;
    }

    private Map<String, Long> findCanonicalFishIds(List<ParsedShopPrice> rows) {
        Set<String> canonicalNames = new LinkedHashSet<>();
        rows.stream()
                .map(ParsedShopPrice::canonicalFishName)
                .filter(name -> name != null && !name.isBlank())
                .forEach(canonicalNames::add);
        if (canonicalNames.isEmpty()) {
            return Map.of();
        }

        MapSqlParameterSource parameters = new MapSqlParameterSource("names", canonicalNames);
        return namedJdbcTemplate.query(
                "select id, name from fish where name in (:names)",
                parameters,
                (ResultSetExtractor<Map<String, Long>>) resultSet -> {
                    Map<String, Long> result = new LinkedHashMap<>();
                    while (resultSet.next()) {
                        result.put(resultSet.getString("name"), resultSet.getLong("id"));
                    }
                    return Map.copyOf(result);
                });
    }

    private int insertChunk(List<ParsedShopPrice> rows, Map<String, Long> fishIdsByName) {
        if (rows.isEmpty()) {
            return 0;
        }
        List<InsertCandidate> candidates = rows.stream()
                .map(row -> new InsertCandidate(row, DedupKeyFactory.create(row)))
                .toList();
        boolean useOnConflict = supportsOnConflict();
        if (!useOnConflict) {
            candidates = excludeExistingHashes(candidates);
            if (candidates.isEmpty()) {
                return 0;
            }
        }
        String valuePlaceholders = String.join(
                ", ", java.util.Collections.nCopies(candidates.size(), "(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"));
        String sql = "insert into shop_price_observation ("
                + INSERT_COLUMNS
                + ") values "
                + valuePlaceholders
                + (useOnConflict ? " on conflict (dedup_hash) do nothing" : "");

        List<InsertCandidate> insertCandidates = candidates;
        return jdbcTemplate.update(connection -> {
            PreparedStatement statement = connection.prepareStatement(sql);
            int parameterIndex = 1;
            for (InsertCandidate candidate : insertCandidates) {
                ParsedShopPrice row = candidate.row();
                Long fishId = fishIdsByName.get(row.canonicalFishName());
                setNullableLong(statement, parameterIndex++, fishId);
                statement.setObject(parameterIndex++, row.observedAt());
                statement.setString(parameterIndex++, row.sourceType());
                setNullableString(statement, parameterIndex++, blankToNull(row.sourceName()));
                setNullableString(statement, parameterIndex++, blankToNull(row.speaker()));
                setNullableString(statement, parameterIndex++, blankToNull(row.canonicalFishName()));
                statement.setString(parameterIndex++, row.reportedName());
                setNullableString(statement, parameterIndex++, blankToNull(row.condition()));
                setNullableString(statement, parameterIndex++, blankToNull(row.origin()));
                setNullableString(statement, parameterIndex++, blankToNull(row.sizeGrade()));
                setNullableString(statement, parameterIndex++, blankToNull(row.unit()));
                statement.setInt(parameterIndex++, row.priceMinKrw());
                statement.setInt(parameterIndex++, row.priceMaxKrw());
                statement.setBigDecimal(parameterIndex++, row.confidence());
                statement.setString(parameterIndex++, row.rawText());
                statement.setString(parameterIndex++, candidate.dedupHash());
            }
            return statement;
        });
    }

    private List<InsertCandidate> excludeExistingHashes(List<InsertCandidate> candidates) {
        Map<String, InsertCandidate> uniqueCandidates = new LinkedHashMap<>();
        candidates.forEach(candidate -> uniqueCandidates.putIfAbsent(candidate.dedupHash(), candidate));
        Set<String> hashes = uniqueCandidates.keySet();
        Set<String> existing = new LinkedHashSet<>(namedJdbcTemplate.queryForList(
                "select dedup_hash from shop_price_observation where dedup_hash in (:hashes)",
                new MapSqlParameterSource("hashes", hashes),
                String.class));
        return uniqueCandidates.values().stream()
                .filter(candidate -> !existing.contains(candidate.dedupHash()))
                .toList();
    }

    private boolean supportsOnConflict() {
        Boolean cached = supportsOnConflict;
        if (cached != null) {
            return cached;
        }
        synchronized (this) {
            if (supportsOnConflict == null) {
                supportsOnConflict = jdbcTemplate.execute((ConnectionCallback<Boolean>) connection ->
                        !"H2".equalsIgnoreCase(connection.getMetaData().getDatabaseProductName()));
            }
            return Boolean.TRUE.equals(supportsOnConflict);
        }
    }

    private void setNullableLong(PreparedStatement statement, int index, Long value) throws SQLException {
        if (value == null) {
            statement.setNull(index, Types.BIGINT);
        } else {
            statement.setLong(index, value);
        }
    }

    private void setNullableString(PreparedStatement statement, int index, String value) throws SQLException {
        if (value == null) {
            statement.setNull(index, Types.VARCHAR);
        } else {
            statement.setString(index, value);
        }
    }

    private String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    private void validatePriceRange(ParsedShopPrice row) {
        if (row.priceMinKrw() <= 0
                || row.priceMaxKrw() <= 0
                || row.priceMinKrw() > row.priceMaxKrw()
                || row.confidence() == null
                || row.confidence().signum() < 0
                || row.confidence().compareTo(java.math.BigDecimal.ONE) > 0) {
            throw new IllegalArgumentException("가격 범위와 신뢰도 값이 올바르지 않습니다.");
        }
    }

    private record InsertCandidate(ParsedShopPrice row, String dedupHash) {}
}
