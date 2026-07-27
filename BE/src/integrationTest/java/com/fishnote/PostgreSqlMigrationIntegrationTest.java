package com.fishnote;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fishnote.image.ImageAssetCleanupPersistenceService;
import com.fishnote.image.ReviewImageAssetStatus;
import com.fishnote.observability.SqlExecutionCounter;
import com.fishnote.price.DedupKeyFactory;
import com.fishnote.price.ParsedShopPrice;
import com.fishnote.price.PriceImportPersistenceService;
import com.fishnote.price.TelegramPriceImportResponse;
import jakarta.persistence.EntityManagerFactory;
import java.math.BigDecimal;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.concurrent.CyclicBarrier;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import org.flywaydb.core.Flyway;
import org.flywaydb.core.api.MigrationInfo;
import org.flywaydb.core.api.MigrationVersion;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.core.env.Environment;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("integration")
@Testcontainers
class PostgreSqlMigrationIntegrationTest {

    private static final int WARMUP_REQUESTS = 5;
    private static final int SAMPLE_REQUESTS = 30;
    private static final Path BASELINE_ARTIFACT =
            Path.of("build", "reports", "baseline", "backend-baseline.json");
    private static final HttpClient HTTP_CLIENT = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(5))
            .build();

    @Container
    private static final PostgreSQLContainer<?> POSTGRESQL =
            new PostgreSQLContainer<>("postgres:16.4-alpine")
                    .withDatabaseName("fishnote_integration")
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
    private Flyway flyway;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private Environment environment;

    @Autowired
    private EntityManagerFactory entityManagerFactory;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private PlatformTransactionManager transactionManager;

    @Autowired
    private ImageAssetCleanupPersistenceService imageAssetCleanupPersistenceService;

    @Autowired
    private PriceImportPersistenceService priceImportPersistenceService;

    @Autowired
    private SqlExecutionCounter sqlExecutionCounter;

    @LocalServerPort
    private int serverPort;

    @Test
    void priceImportUsesSha256DedupForConcurrentNullSourceAndLongRawText() throws Exception {
        String rawText = "🐟".repeat(5_000) + UUID.randomUUID();
        ParsedShopPrice row = new ParsedShopPrice(
                OffsetDateTime.parse("2026-07-22T08:00:00+09:00"),
                "telegram_bot",
                null,
                null,
                "광어",
                "광어",
                "양식",
                "제주",
                "2kg",
                "kg",
                31_000,
                33_000,
                new BigDecimal("0.90"),
                rawText);
        jdbcTemplate.update("delete from shop_price_observation where raw_text = ?", rawText);

        int workers = 20;
        CyclicBarrier barrier = new CyclicBarrier(workers);
        ExecutorService executor = Executors.newFixedThreadPool(workers);
        List<Future<TelegramPriceImportResponse>> futures = new ArrayList<>();
        try {
            for (int index = 0; index < workers; index++) {
                futures.add(executor.submit(() -> {
                    barrier.await();
                    return priceImportPersistenceService.persist(List.of(row), List.of(), null);
                }));
            }
            int saved = 0;
            for (Future<TelegramPriceImportResponse> future : futures) {
                saved += future.get().savedCount();
            }
            assertThat(saved).isEqualTo(1);
        } finally {
            executor.shutdownNow();
        }

        Map<String, Object> stored = jdbcTemplate.queryForMap(
                "select source_name, raw_text, dedup_hash from shop_price_observation where raw_text = ?",
                rawText);
        assertThat(stored.get("source_name")).isNull();
        assertThat(stored.get("raw_text")).isEqualTo(rawText);
        assertThat(stored.get("dedup_hash")).isEqualTo(DedupKeyFactory.create(row));
        assertThat(jdbcTemplate.queryForObject(
                        "select count(*) from shop_price_observation_duplicate_audit",
                        Long.class))
                .isNotNull();
        assertThat(jdbcTemplate.queryForObject(
                        """
                        select count(*)
                        from pg_indexes
                        where schemaname = current_schema()
                          and indexname = 'uq_shop_price_observation_dedup_hash'
                        """,
                        Long.class))
                .isEqualTo(1L);
        assertThat(jdbcTemplate.queryForObject(
                        """
                        select count(*)
                        from information_schema.table_constraints
                        where table_schema = current_schema()
                          and table_name = 'shop_price_observation'
                          and constraint_name = 'uq_shop_price_observation'
                        """,
                        Long.class))
                .isZero();
    }

    @Test
    void priceDedupMigrationAuditsLegacyDuplicatesBeforeEnforcement() {
        String schema = "price_v15_" + UUID.randomUUID().toString().replace("-", "");
        String dataSourceUrl = environment.getRequiredProperty("spring.datasource.url");
        String username = environment.getRequiredProperty("spring.datasource.username");
        String password = environment.getRequiredProperty("spring.datasource.password");
        DriverManagerDataSource isolatedDataSource =
                new DriverManagerDataSource(dataSourceUrl, username, password);
        JdbcTemplate isolated = new JdbcTemplate(isolatedDataSource);
        String qualifiedObservation = schema + ".shop_price_observation";
        String rawText = "null source legacy duplicate 🐟";
        OffsetDateTime observedAt = OffsetDateTime.parse("2026-07-22T08:00:00+09:00");

        try {
            Flyway.configure()
                    .dataSource(isolatedDataSource)
                    .schemas(schema)
                    .defaultSchema(schema)
                    .locations("classpath:db/migration")
                    .target("14")
                    .load()
                    .migrate();

            String legacyInsert = """
                    insert into %s (
                        observed_at, source_type, source_name, canonical_fish_name, reported_name,
                        price_min_krw, price_max_krw, confidence, raw_text
                    ) values (?, 'telegram_bot', null, '광어', '광어', 31000, 33000, 0.90, ?)
                    """.formatted(qualifiedObservation);
            isolated.update(legacyInsert, observedAt, rawText);
            isolated.update(legacyInsert, observedAt, rawText);

            Flyway.configure()
                    .dataSource(isolatedDataSource)
                    .schemas(schema)
                    .defaultSchema(schema)
                    .locations("classpath:db/migration")
                    .load()
                    .migrate();

            assertThat(isolated.queryForObject(
                            "select count(*) from " + qualifiedObservation,
                            Long.class))
                    .isEqualTo(1L);
            assertThat(isolated.queryForObject(
                            "select count(*) from " + schema + ".shop_price_observation_duplicate_audit",
                            Long.class))
                    .isEqualTo(1L);
            ParsedShopPrice row = new ParsedShopPrice(
                    observedAt,
                    "telegram_bot",
                    null,
                    null,
                    "광어",
                    "광어",
                    null,
                    null,
                    null,
                    null,
                    31_000,
                    33_000,
                    new BigDecimal("0.90"),
                    rawText);
            assertThat(isolated.queryForObject(
                            "select dedup_hash from " + qualifiedObservation,
                            String.class))
                    .isEqualTo(DedupKeyFactory.create(row));
        } finally {
            isolated.execute("drop schema if exists " + schema + " cascade");
        }
    }

    @Test
    void latestSchemaStillAcceptsLegacyPriceWriterWithoutDedupHash() {
        String rawText = "legacy-writer-" + UUID.randomUUID();
        OffsetDateTime observedAt = OffsetDateTime.parse("2026-07-22T09:15:30.123+09:00");
        try {
            jdbcTemplate.update(
                    """
                    insert into shop_price_observation (
                        observed_at, source_type, source_name, canonical_fish_name, reported_name,
                        price_min_krw, price_max_krw, confidence, raw_text
                    ) values (?, 'telegram_bot', null, '광어', '광어', 31000, 33000, 0.90, ?)
                    """,
                    observedAt,
                    rawText);

            ParsedShopPrice legacyRow = new ParsedShopPrice(
                    observedAt,
                    "telegram_bot",
                    null,
                    null,
                    "광어",
                    "광어",
                    null,
                    null,
                    null,
                    null,
                    31_000,
                    33_000,
                    new BigDecimal("0.90"),
                    rawText);
            assertThat(jdbcTemplate.queryForObject(
                            "select dedup_hash from shop_price_observation where raw_text = ?",
                            String.class,
                            rawText))
                    .isEqualTo(DedupKeyFactory.create(legacyRow));
        } finally {
            jdbcTemplate.update(
                    "delete from shop_price_observation where raw_text = ?",
                    rawText);
        }
    }

    @Test
    void appliesEveryMigrationFromVersionOneThroughLatest() {
        List<String> appliedVersions = Arrays.stream(flyway.info().applied())
                .map(MigrationInfo::getVersion)
                .filter(Objects::nonNull)
                .map(MigrationVersion::getVersion)
                .toList();

        assertThat(appliedVersions)
                .isNotEmpty()
                .first()
                .as("the empty PostgreSQL database must start at Flyway V1")
                .isEqualTo("1");
        assertThat(flyway.info().pending())
                .as("every migration through the latest version must be applied")
                .isEmpty();

        Long baselineRows = jdbcTemplate.queryForObject(
                "SELECT count(*) FROM flyway_schema_history WHERE type = 'BASELINE'",
                Long.class);
        Long failedRows = jdbcTemplate.queryForObject(
                "SELECT count(*) FROM flyway_schema_history WHERE success = false",
                Long.class);

        assertThat(baselineRows).isZero();
        assertThat(failedRows).isZero();
    }

    @Test
    void startsHibernateWithPostgreSqlSchemaValidationEnabled() {
        assertThat(environment.getProperty("spring.jpa.hibernate.ddl-auto"))
                .isEqualTo("validate");
        assertThat(entityManagerFactory.isOpen()).isTrue();
        assertThat(jdbcTemplate.queryForObject(
                        "SELECT current_setting('server_version_num')", String.class))
                .isNotBlank();
    }

    @Test
    void createsReviewImageAssetLifecycleSchema() {
        Integer columnCount = jdbcTemplate.queryForObject(
                """
                SELECT count(*)
                FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = 'review_image_asset'
                """,
                Integer.class);
        List<String> constraints = jdbcTemplate.queryForList(
                """
                SELECT conname
                FROM pg_constraint
                WHERE conrelid = 'review_image_asset'::regclass
                """,
                String.class);
        String cleanupIndex = jdbcTemplate.queryForObject(
                """
                SELECT indexdef
                FROM pg_indexes
                WHERE schemaname = 'public'
                  AND tablename = 'review_image_asset'
                  AND indexname = 'idx_review_image_asset_cleanup'
                """,
                String.class);

        assertThat(columnCount).isEqualTo(16);
        assertThat(constraints)
                .contains("ck_review_image_asset_status", "ck_review_image_asset_state");
        assertThat(cleanupIndex)
                .contains("cleanup_available_at", "id")
                .contains("DELETE_PENDING")
                .contains("WHERE");
        List<String> lifecycleIndexes = jdbcTemplate.queryForList(
                """
                SELECT indexdef
                FROM pg_indexes
                WHERE schemaname = 'public'
                  AND tablename = 'review_image_asset'
                  AND indexname IN (
                      'idx_review_image_asset_expiry',
                      'idx_review_image_asset_claimed',
                      'idx_review_image_asset_orphan')
                """,
                String.class);
        assertThat(lifecycleIndexes)
                .anyMatch(index -> index.contains("expires_at") && index.contains("PENDING"))
                .anyMatch(index -> index.contains("updated_at")
                        && index.contains("deletion_claim_id IS NOT NULL"))
                .anyMatch(index -> index.contains("ATTACHED") && index.contains("review_id IS NULL"));
    }

    @Test
    void createsCatalogSearchSchemaAndSeedsDeterministicAliases() {
        List<String> columns = jdbcTemplate.queryForList(
                """
                SELECT column_name
                FROM information_schema.columns
                WHERE table_schema = 'public'
                  AND table_name = 'fish'
                  AND column_name IN ('slug', 'category', 'scientific_name')
                ORDER BY column_name
                """,
                String.class);
        String abaloneCategory = jdbcTemplate.queryForObject(
                "SELECT category FROM fish WHERE id = 24 AND name = '전복'",
                String.class);
        Integer mappedSlugCount = jdbcTemplate.queryForObject(
                """
                SELECT count(*)
                FROM fish
                WHERE id IN (1, 2, 3, 4, 5, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19,
                             20, 21, 22, 23, 24, 25, 26, 27)
                  AND slug IS NOT NULL
                """,
                Integer.class);
        Integer distinctSlugCount = jdbcTemplate.queryForObject(
                "SELECT count(DISTINCT slug) FROM fish WHERE slug IS NOT NULL",
                Integer.class);
        List<String> aliasMappings = jdbcTemplate.queryForList(
                """
                SELECT a.alias || '→' || f.name
                FROM fish_alias a
                JOIN fish f ON f.id = a.fish_id
                WHERE a.alias IN ('넙치', '도미', '하모', '아나고', '밀치')
                ORDER BY a.alias
                """,
                String.class);
        List<String> searchIndexes = jdbcTemplate.queryForList(
                """
                SELECT indexname
                FROM pg_indexes
                WHERE schemaname = 'public'
                  AND indexname IN (
                      'uq_fish_name',
                      'uq_fish_slug',
                      'uq_fish_alias_normalized',
                      'idx_fish_name_trgm',
                      'idx_fish_name_en_trgm',
                      'idx_fish_alias_trgm')
                ORDER BY indexname
                """,
                String.class);
        Map<String, String> searchIndexDefinitions = jdbcTemplate.query(
                """
                SELECT indexname, indexdef
                FROM pg_indexes
                WHERE schemaname = 'public'
                  AND indexname IN (
                      'uq_fish_name',
                      'uq_fish_slug',
                      'uq_fish_alias_normalized',
                      'idx_fish_name_trgm',
                      'idx_fish_name_en_trgm',
                      'idx_fish_alias_trgm')
                """,
                resultSet -> {
                    Map<String, String> definitions = new LinkedHashMap<>();
                    while (resultSet.next()) {
                        definitions.put(resultSet.getString("indexname"), resultSet.getString("indexdef"));
                    }
                    return definitions;
                });
        Map<Long, String> seededSlugs = jdbcTemplate.query(
                "SELECT id, slug FROM fish WHERE slug IS NOT NULL ORDER BY id",
                resultSet -> {
                    Map<Long, String> slugs = new LinkedHashMap<>();
                    while (resultSet.next()) {
                        slugs.put(resultSet.getLong("id"), resultSet.getString("slug"));
                    }
                    return slugs;
                });
        Integer trigramExtensionCount = jdbcTemplate.queryForObject(
                "SELECT count(*) FROM pg_extension WHERE extname = 'pg_trgm'",
                Integer.class);

        assertThat(columns).containsExactly("category", "scientific_name", "slug");
        assertThat(abaloneCategory).isEqualTo("SHELLFISH");
        assertThat(mappedSlugCount).isEqualTo(26);
        assertThat(distinctSlugCount).isEqualTo(mappedSlugCount);
        assertThat(seededSlugs).isEqualTo(Map.ofEntries(
                Map.entry(1L, "gwangeo"),
                Map.entry(2L, "bangeo"),
                Map.entry(3L, "ureok"),
                Map.entry(4L, "chamdom"),
                Map.entry(5L, "yeoneo"),
                Map.entry(7L, "mineo"),
                Map.entry(8L, "nongeo"),
                Map.entry(9L, "jeoneo"),
                Map.entry(10L, "dodari"),
                Map.entry(11L, "gamseongdom"),
                Map.entry(12L, "doldom"),
                Map.entry(13L, "byeongeo"),
                Map.entry(14L, "gaetjangeo"),
                Map.entry(15L, "bungjangeo"),
                Map.entry(16L, "gasungeo"),
                Map.entry(17L, "godeungeo"),
                Map.entry(18L, "galchi"),
                Map.entry(19L, "sungeo"),
                Map.entry(20L, "gajami"),
                Map.entry(21L, "bulgbari"),
                Map.entry(22L, "neungseongeo"),
                Map.entry(23L, "jabari"),
                Map.entry(24L, "jeonbok"),
                Map.entry(25L, "shimaaji"),
                Map.entry(26L, "eoreumdom"),
                Map.entry(27L, "jeomseongeo")));
        assertThat(aliasMappings)
                .containsExactlyInAnyOrder(
                        "넙치→광어",
                        "도미→참돔",
                        "하모→갯장어",
                        "아나고→붕장어",
                        "밀치→가숭어");
        assertThat(searchIndexes).containsExactly(
                "idx_fish_alias_trgm",
                "idx_fish_name_en_trgm",
                "idx_fish_name_trgm",
                "uq_fish_alias_normalized",
                "uq_fish_name",
                "uq_fish_slug");
        assertThat(searchIndexDefinitions.get("uq_fish_alias_normalized"))
                .contains("UNIQUE", "lower((alias)::text)");
        assertThat(searchIndexDefinitions.get("uq_fish_name"))
                .contains("UNIQUE", "(name)");
        assertThat(searchIndexDefinitions.get("uq_fish_slug"))
                .contains("UNIQUE", "(slug)");
        assertThat(searchIndexDefinitions.get("idx_fish_name_trgm"))
                .contains("USING gin", "lower((name)::text)", "gin_trgm_ops");
        assertThat(searchIndexDefinitions.get("idx_fish_name_en_trgm"))
                .contains("USING gin", "lower((name_en)::text)", "gin_trgm_ops");
        assertThat(searchIndexDefinitions.get("idx_fish_alias_trgm"))
                .contains("USING gin", "lower((alias)::text)", "gin_trgm_ops");
        assertThat(trigramExtensionCount).isOne();

        Long rollingFishId = jdbcTemplate.queryForObject(
                "INSERT INTO fish (name) VALUES ('rolling-writer-fixture') RETURNING id",
                Long.class);
        try {
            Map<String, Object> rollingRow = jdbcTemplate.queryForMap(
                    "SELECT slug, category FROM fish WHERE id = ?",
                    rollingFishId);
            assertThat(rollingRow.get("slug")).isNull();
            assertThat(rollingRow.get("category")).isEqualTo("FISH");
            assertThatThrownBy(() -> jdbcTemplate.update(
                            "INSERT INTO fish (name) VALUES ('rolling-writer-fixture')"))
                    .hasMessageContaining("uq_fish_name");
            assertThatThrownBy(() -> jdbcTemplate.update(
                            "UPDATE fish SET slug = 'gwangeo' WHERE id = ?",
                            rollingFishId))
                    .hasMessageContaining("uq_fish_slug");

            jdbcTemplate.update(
                    "INSERT INTO fish_alias (fish_id, alias, alias_type) VALUES (?, 'CaseAlias', 'MARKET')",
                    rollingFishId);
            assertThatThrownBy(() -> jdbcTemplate.update(
                            "INSERT INTO fish_alias (fish_id, alias, alias_type) VALUES (?, 'casealias', 'MARKET')",
                            rollingFishId))
                    .hasMessageContaining("uq_fish_alias_normalized");

            jdbcTemplate.update("DELETE FROM fish WHERE id = ?", rollingFishId);
            assertThat(jdbcTemplate.queryForObject(
                            "SELECT count(*) FROM fish_alias WHERE fish_id = ?",
                            Integer.class,
                            rollingFishId))
                    .isZero();
        } finally {
            jdbcTemplate.update("DELETE FROM fish WHERE id = ?", rollingFishId);
        }
    }

    @Test
    void createsSourceCorrectionSchemaAndSeedsOnlyReviewedSeasonSources() {
        List<String> sourceColumns = jdbcTemplate.queryForList(
                """
                SELECT column_name
                FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = 'fish_source'
                ORDER BY ordinal_position
                """,
                String.class);
        List<String> correctionColumns = jdbcTemplate.queryForList(
                """
                SELECT column_name
                FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = 'fish_correction_request'
                ORDER BY ordinal_position
                """,
                String.class);
        List<String> sourceConstraints = jdbcTemplate.queryForList(
                """
                SELECT conname
                FROM pg_constraint
                WHERE conrelid = 'fish_source'::regclass
                ORDER BY conname
                """,
                String.class);
        List<String> correctionConstraints = jdbcTemplate.queryForList(
                """
                SELECT conname
                FROM pg_constraint
                WHERE conrelid = 'fish_correction_request'::regclass
                ORDER BY conname
                """,
                String.class);
        Map<String, String> sourceIndexes = jdbcTemplate.query(
                """
                SELECT indexname, indexdef
                FROM pg_indexes
                WHERE schemaname = 'public' AND tablename = 'fish_source'
                """,
                resultSet -> {
                    Map<String, String> definitions = new LinkedHashMap<>();
                    while (resultSet.next()) {
                        definitions.put(resultSet.getString("indexname"), resultSet.getString("indexdef"));
                    }
                    return definitions;
                });
        Map<String, String> correctionIndexes = jdbcTemplate.query(
                """
                SELECT indexname, indexdef
                FROM pg_indexes
                WHERE schemaname = 'public' AND tablename = 'fish_correction_request'
                """,
                resultSet -> {
                    Map<String, String> definitions = new LinkedHashMap<>();
                    while (resultSet.next()) {
                        definitions.put(resultSet.getString("indexname"), resultSet.getString("indexdef"));
                    }
                    return definitions;
                });
        Map<String, String> deleteActions = jdbcTemplate.query(
                """
                SELECT conname, confdeltype::text AS delete_action
                FROM pg_constraint
                WHERE conname IN ('fk_fish_source_fish', 'fk_fish_correction_request_fish')
                ORDER BY conname
                """,
                resultSet -> {
                    Map<String, String> actions = new LinkedHashMap<>();
                    while (resultSet.next()) {
                        actions.put(resultSet.getString("conname"), resultSet.getString("delete_action"));
                    }
                    return actions;
                });
        List<SeededFishSource> seededSources = jdbcTemplate.query(
                """
                SELECT fish_id, claim_type, publisher, title, url, published_at,
                       verified_at, license, confidence
                FROM fish_source
                WHERE claim_type = 'SEASON'
                ORDER BY fish_id
                """,
                (resultSet, rowNumber) -> new SeededFishSource(
                        resultSet.getLong("fish_id"),
                        resultSet.getString("claim_type"),
                        resultSet.getString("publisher"),
                        resultSet.getString("title"),
                        resultSet.getString("url"),
                        resultSet.getObject("published_at", LocalDate.class),
                        resultSet.getObject("verified_at", OffsetDateTime.class),
                        resultSet.getString("license"),
                        resultSet.getString("confidence")));

        assertThat(sourceColumns).containsExactly(
                "id",
                "fish_id",
                "claim_type",
                "publisher",
                "title",
                "url",
                "published_at",
                "verified_at",
                "license",
                "confidence",
                "created_at");
        assertThat(correctionColumns).containsExactly(
                "id",
                "fish_id",
                "claim_type",
                "message",
                "source_url",
                "status",
                "created_at",
                "resolved_at");
        assertThat(sourceConstraints).contains(
                "fk_fish_source_fish",
                "ck_fish_source_claim_type",
                "ck_fish_source_confidence",
                "ck_fish_source_publisher_not_blank",
                "ck_fish_source_title_not_blank",
                "ck_fish_source_url_http",
                "uq_fish_source_claim_url");
        assertThat(correctionConstraints).contains(
                "fk_fish_correction_request_fish",
                "ck_fish_correction_request_claim_type",
                "ck_fish_correction_request_message_not_blank",
                "ck_fish_correction_request_source_url_http",
                "ck_fish_correction_request_status",
                "ck_fish_correction_request_resolution");
        assertThat(deleteActions).containsEntry("fk_fish_source_fish", "c");
        assertThat(deleteActions).containsEntry("fk_fish_correction_request_fish", "c");
        assertThat(sourceIndexes).containsKeys(
                "uq_fish_source_claim_url", "idx_fish_source_fish_claim_verified");
        assertThat(sourceIndexes.get("uq_fish_source_claim_url"))
                .contains("UNIQUE", "fish_id", "claim_type", "url");
        assertThat(sourceIndexes.get("idx_fish_source_fish_claim_verified"))
                .contains("fish_id", "claim_type", "verified_at DESC", "id");
        assertThat(correctionIndexes).containsKeys(
                "idx_fish_correction_request_fish_created",
                "idx_fish_correction_request_status_created");

        OffsetDateTime verifiedAt = OffsetDateTime.parse("2026-07-15T00:00:00Z");
        OffsetDateTime expandedVerifiedAt = OffsetDateTime.parse("2026-07-25T00:00:00Z");
        String publisher = "인천광역시 수산자원연구소";
        String license = "공공누리 제1유형(출처표시)";
        assertThat(seededSources).containsExactly(
                new SeededFishSource(
                        3L,
                        "SEASON",
                        publisher,
                        "2026년 5월, 어식백세 수산물 \"다시마, 조피볼락\"",
                        "https://www.incheon.go.kr/fish/FI020401/3070620",
                        LocalDate.of(2026, 5, 11),
                        verifiedAt,
                        license,
                        "HIGH"),
                new SeededFishSource(
                        7L,
                        "SEASON",
                        publisher,
                        "2023년 8월, 어식백세 수산물 “민어, 한치\"",
                        "https://www.incheon.go.kr/fish/FI020401/2142497",
                        LocalDate.of(2023, 8, 14),
                        verifiedAt,
                        license,
                        "HIGH"),
                new SeededFishSource(
                        8L,
                        "SEASON",
                        publisher,
                        "2020년 6월 어식백세 수산물 \"광어, 농어\"",
                        "https://www.incheon.go.kr/fish/FI020401/2050291",
                        LocalDate.of(2020, 6, 8),
                        expandedVerifiedAt,
                        license,
                        "HIGH"),
                new SeededFishSource(
                        9L,
                        "SEASON",
                        publisher,
                        "2024년 9월, 어식백세 수산물 \"대하, 전어\"",
                        "https://www.incheon.go.kr/fish/FI020401/2207048",
                        LocalDate.of(2024, 9, 11),
                        expandedVerifiedAt,
                        license,
                        "HIGH"),
                new SeededFishSource(
                        10L,
                        "SEASON",
                        publisher,
                        "2026년 3월, 어식백세 수산물 \"도다리, 멍게\"",
                        "https://www.incheon.go.kr/fish/FI020401/3065118",
                        LocalDate.of(2026, 3, 7),
                        verifiedAt,
                        license,
                        "HIGH"),
                new SeededFishSource(
                        11L,
                        "SEASON",
                        publisher,
                        "2024년 10월, 어식백세 수산물 \"삼치, 감성돔\"",
                        "https://www.incheon.go.kr/fish/FI020401/2209903",
                        LocalDate.of(2024, 9, 30),
                        verifiedAt,
                        license,
                        "HIGH"),
                new SeededFishSource(
                        13L,
                        "SEASON",
                        publisher,
                        "2023년 6월 어식백세 수산물 “재첩, 병어”",
                        "https://www.incheon.go.kr/fish/FI020401/2128808",
                        LocalDate.of(2023, 6, 10),
                        verifiedAt,
                        license,
                        "HIGH"),
                new SeededFishSource(
                        14L,
                        "SEASON",
                        publisher,
                        "2024년 8월, 어식백세 수산물 \"장어류, 문어\"",
                        "https://www.incheon.go.kr/fish/FI020401/2203724",
                        LocalDate.of(2024, 8, 20),
                        expandedVerifiedAt,
                        license,
                        "MEDIUM"),
                new SeededFishSource(
                        15L,
                        "SEASON",
                        publisher,
                        "2024년 8월, 어식백세 수산물 \"장어류, 문어\"",
                        "https://www.incheon.go.kr/fish/FI020401/2203724",
                        LocalDate.of(2024, 8, 20),
                        expandedVerifiedAt,
                        license,
                        "MEDIUM"),
                new SeededFishSource(
                        20L,
                        "SEASON",
                        publisher,
                        "2026년 4월, 어식백세 수산물 \"가자미, 홍어\"",
                        "https://www.incheon.go.kr/fish/FI020401/3067203",
                        LocalDate.of(2026, 4, 3),
                        verifiedAt,
                        license,
                        "HIGH"));

        assertThatThrownBy(() -> jdbcTemplate.update(
                        """
                        INSERT INTO fish_source (
                            fish_id, claim_type, publisher, title, url, confidence)
                        VALUES (3, 'SEASON', '검증기관', '중복',
                                'https://www.incheon.go.kr/fish/FI020401/3070620', 'HIGH')
                        """))
                .hasMessageContaining("uq_fish_source_claim_url");
        assertThatThrownBy(() -> jdbcTemplate.update(
                        """
                        INSERT INTO fish_source (
                            fish_id, claim_type, publisher, title, url, confidence)
                        VALUES (3, 'SEASON', '검증기관', '잘못된 신뢰도',
                                'https://example.test/invalid-confidence', 'UNKNOWN')
                        """))
                .hasMessageContaining("ck_fish_source_confidence");
        assertThatThrownBy(() -> jdbcTemplate.update(
                        """
                        INSERT INTO fish_correction_request (
                            fish_id, claim_type, message, source_url)
                        VALUES (3, 'SEASON', '수정 요청', 'javascript:alert(1)')
                        """))
                .hasMessageContaining("ck_fish_correction_request_source_url_http");
    }

    @Test
    void expandsFishImageMetadataWithoutLosingLegacyRows() {
        List<String> columns = jdbcTemplate.queryForList(
                """
                SELECT column_name
                FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = 'fish_image'
                """,
                String.class);
        List<String> constraints = jdbcTemplate.queryForList(
                """
                SELECT conname
                FROM pg_constraint
                WHERE conrelid = 'fish_image'::regclass
                ORDER BY conname
                """,
                String.class);
        List<String> primaryKeyColumns = jdbcTemplate.queryForList(
                """
                SELECT key_column_usage.column_name
                FROM information_schema.table_constraints
                JOIN information_schema.key_column_usage
                  ON key_column_usage.constraint_catalog = table_constraints.constraint_catalog
                 AND key_column_usage.constraint_schema = table_constraints.constraint_schema
                 AND key_column_usage.constraint_name = table_constraints.constraint_name
                WHERE table_constraints.table_schema = 'public'
                  AND table_constraints.table_name = 'fish_image'
                  AND table_constraints.constraint_type = 'PRIMARY KEY'
                ORDER BY key_column_usage.ordinal_position
                """,
                String.class);
        Map<String, String> indexes = jdbcTemplate.query(
                """
                SELECT indexname, indexdef
                FROM pg_indexes
                WHERE schemaname = 'public' AND tablename = 'fish_image'
                """,
                resultSet -> {
                    Map<String, String> definitions = new LinkedHashMap<>();
                    while (resultSet.next()) {
                        definitions.put(resultSet.getString("indexname"), resultSet.getString("indexdef"));
                    }
                    return definitions;
                });
        String idDefault = jdbcTemplate.queryForObject(
                """
                SELECT column_default
                FROM information_schema.columns
                WHERE table_schema = 'public'
                  AND table_name = 'fish_image'
                  AND column_name = 'id'
                """,
                String.class);
        List<LegacyFishImageRow> legacyRows = jdbcTemplate.query(
                """
                SELECT id, fish_id, image_order, role, url, alt, width, height
                FROM fish_image
                WHERE fish_id IN (1, 2, 4, 5) AND image_order = 0
                ORDER BY fish_id
                """,
                (resultSet, rowNumber) -> new LegacyFishImageRow(
                        resultSet.getLong("id"),
                        resultSet.getLong("fish_id"),
                        resultSet.getInt("image_order"),
                        resultSet.getString("role"),
                        resultSet.getString("url"),
                        resultSet.getString("alt"),
                        resultSet.getObject("width", Integer.class),
                        resultSet.getObject("height", Integer.class)));
        Integer legacyPrimaryCount = jdbcTemplate.queryForObject(
                """
                SELECT count(*)
                FROM fish_image
                WHERE fish_id IN (1, 2, 4, 5)
                  AND image_order = 0
                  AND role = 'PRIMARY'
                """,
                Integer.class);

        assertThat(columns).contains(
                "id",
                "fish_id",
                "image_order",
                "role",
                "url",
                "public_id",
                "width",
                "height",
                "alt",
                "credit",
                "source_url",
                "license",
                "focal_x",
                "focal_y",
                "blur_data_url",
                "created_at",
                "updated_at");
        assertThat(primaryKeyColumns).containsExactly("id");
        assertThat(constraints).contains(
                "fish_image_pkey",
                "fish_image_fish_id_fkey",
                "uq_fish_image_order",
                "ck_fish_image_order",
                "ck_fish_image_role",
                "ck_fish_image_url_not_blank",
                "ck_fish_image_alt_not_blank",
                "ck_fish_image_dimensions",
                "ck_fish_image_focal_point",
                "ck_fish_image_public_id_not_blank",
                "ck_fish_image_source_url_http",
                "ck_fish_image_attribution",
                "ck_fish_image_blur_data_url");
        assertThat(indexes).containsKeys(
                "uq_fish_image_order",
                "uq_fish_image_public_id",
                "uq_fish_image_primary",
                "idx_fish_image_fish_role_order");
        assertThat(indexes.get("uq_fish_image_order"))
                .contains("UNIQUE", "fish_id", "image_order");
        assertThat(indexes.get("uq_fish_image_primary"))
                .contains("UNIQUE", "fish_id", "WHERE", "PRIMARY");
        assertThat(indexes.get("idx_fish_image_fish_role_order"))
                .contains("fish_id", "role", "image_order");
        assertThat(idDefault).contains("nextval", "fish_image_id_seq");

        assertThat(legacyRows).hasSize(4);
        assertThat(legacyRows)
                .extracting(LegacyFishImageRow::fishId)
                .containsExactly(1L, 2L, 4L, 5L);
        assertThat(legacyRows).allSatisfy(row -> {
            assertThat(row.id()).isPositive();
            assertThat(row.imageOrder()).isZero();
            assertThat(row.role()).isEqualTo("PRIMARY");
            assertThat(row.alt()).isNotBlank();
            assertThat(row.width() == null || row.width() > 0).isTrue();
            assertThat(row.height() == null || row.height() > 0).isTrue();
        });
        assertThat(legacyPrimaryCount).isEqualTo(4);

        assertThatThrownBy(() -> jdbcTemplate.update(
                        """
                        INSERT INTO fish_image (fish_id, image_order, role, url, alt)
                        VALUES (1, 0, 'GALLERY', '/duplicate-order.jpg', '중복 순서')
                        """))
                .hasMessageContaining("uq_fish_image_order");
        assertThatThrownBy(() -> jdbcTemplate.update(
                        """
                        INSERT INTO fish_image (fish_id, image_order, role, url, alt)
                        VALUES (1, 99, 'PRIMARY', '/duplicate-primary.jpg', '중복 대표')
                        """))
                .hasMessageContaining("uq_fish_image_primary");
        assertThatThrownBy(() -> jdbcTemplate.update(
                        """
                        INSERT INTO fish_image (
                            fish_id, image_order, role, url, width, height, alt)
                        VALUES (3, 98, 'GALLERY', '/invalid-dimension.jpg', 0, 10, '잘못된 크기')
                        """))
                .hasMessageContaining("ck_fish_image_dimensions");
        assertThatThrownBy(() -> jdbcTemplate.update(
                        """
                        INSERT INTO fish_image (
                            fish_id, image_order, role, url, width, height, alt, focal_x, focal_y)
                        VALUES (3, 97, 'GALLERY', '/invalid-focal.jpg', 10, 10, '잘못된 초점', 1.2, 0.5)
                        """))
                .hasMessageContaining("ck_fish_image_focal_point");
        assertThatThrownBy(() -> jdbcTemplate.update(
                        """
                        INSERT INTO fish_image (
                            fish_id, image_order, role, url, alt, credit)
                        VALUES (3, 96, 'GALLERY', '/partial-credit.jpg', '불완전한 출처', '촬영자')
                        """))
                .hasMessageContaining("ck_fish_image_attribution");
    }

    @Test
    void v12AlonePreservesEveryLegacyFishImageUrlBeforeContentMigrations() {
        String schema = "v12_fish_image_verification";
        Flyway v12Flyway = Flyway.configure()
                .dataSource(
                        POSTGRESQL.getJdbcUrl(),
                        POSTGRESQL.getUsername(),
                        POSTGRESQL.getPassword())
                .schemas(schema)
                .defaultSchema(schema)
                .target("12")
                .cleanDisabled(false)
                .load();

        try {
            v12Flyway.clean();
            v12Flyway.migrate();

            List<LegacyFishImageRow> rows = jdbcTemplate.query(
                    """
                    SELECT id, fish_id, image_order, role, url, alt, width, height
                    FROM v12_fish_image_verification.fish_image
                    ORDER BY fish_id, image_order
                    """,
                    (resultSet, rowNumber) -> new LegacyFishImageRow(
                            resultSet.getLong("id"),
                            resultSet.getLong("fish_id"),
                            resultSet.getInt("image_order"),
                            resultSet.getString("role"),
                            resultSet.getString("url"),
                            resultSet.getString("alt"),
                            resultSet.getObject("width", Integer.class),
                            resultSet.getObject("height", Integer.class)));

            assertThat(v12Flyway.info().current().getVersion().getVersion()).isEqualTo("12");
            assertThat(rows).hasSize(4);
            assertThat(rows)
                    .extracting(LegacyFishImageRow::fishId)
                    .containsExactly(1L, 2L, 4L, 5L);
            assertThat(rows)
                    .extracting(LegacyFishImageRow::url)
                    .containsExactly(
                            "/fish/gwangeo.jpg",
                            "/fish/bangeo.jpg",
                            "/fish/chamdom.jpg",
                            "/fish/yeoneo.jpg");
            assertThat(rows).allSatisfy(row -> {
                assertThat(row.id()).isPositive();
                assertThat(row.imageOrder()).isZero();
                assertThat(row.role()).isEqualTo("PRIMARY");
                assertThat(row.alt()).isNotBlank();
                assertThat(row.width()).isNull();
                assertThat(row.height()).isNull();
            });
        } finally {
            v12Flyway.clean();
        }
    }

    @Test
    void seedsReviewedRepresentativeImagesForTheEntirePublicCatalog() {
        List<Long> readyFishIds = jdbcTemplate.queryForList(
                """
                SELECT fish_id
                FROM fish_image
                WHERE role = 'PRIMARY' AND image_order = 0
                ORDER BY fish_id
                """,
                Long.class);
        Integer completeMetadataCount = jdbcTemplate.queryForObject(
                """
                SELECT count(*)
                FROM fish_image
                WHERE role = 'PRIMARY'
                  AND image_order = 0
                  AND width > 0
                  AND height > 0
                  AND btrim(alt) <> ''
                  AND btrim(credit) <> ''
                  AND source_url ~ '^https://'
                  AND btrim(license) <> ''
                  AND focal_x BETWEEN 0 AND 1
                  AND focal_y BETWEEN 0 AND 1
                """,
                Integer.class);
        Integer fallbackMismatchCount = jdbcTemplate.queryForObject(
                """
                SELECT count(*)
                FROM fish
                JOIN fish_image image
                  ON image.fish_id = fish.id AND image.role = 'PRIMARY'
                WHERE fish.image_url IS DISTINCT FROM image.url
                """,
                Integer.class);
        Integer attributedPhotoSourceCount = jdbcTemplate.queryForObject(
                """
                SELECT count(*)
                FROM fish_image image
                JOIN fish_source source
                  ON source.fish_id = image.fish_id
                 AND source.claim_type = 'PHOTO'
                 AND source.url = image.source_url
                 AND source.license = image.license
                 AND source.confidence = 'HIGH'
                WHERE image.role = 'PRIMARY'
                """,
                Integer.class);
        Integer readyScientificNameCount = jdbcTemplate.queryForObject(
                """
                SELECT count(*)
                FROM fish
                WHERE id IN (
                    1, 2, 3, 4, 5, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17,
                    18, 19, 20, 21, 22, 23, 24, 25, 26, 27
                )
                  AND scientific_name IS NOT NULL
                  AND btrim(scientific_name) <> ''
                """,
                Integer.class);
        assertThat(readyFishIds).containsExactly(
                1L, 2L, 3L, 4L, 5L, 7L, 8L, 9L, 10L, 11L, 12L, 13L, 14L,
                15L, 16L, 17L, 18L, 19L, 20L, 21L, 22L, 23L, 24L, 25L, 26L, 27L);
        assertThat(completeMetadataCount).isEqualTo(26);
        assertThat(fallbackMismatchCount).isZero();
        assertThat(attributedPhotoSourceCount).isEqualTo(26);
        assertThat(readyScientificNameCount).isEqualTo(26);
        assertThat(jdbcTemplate.queryForObject(
                        "SELECT scientific_name FROM fish WHERE id = 20",
                        String.class))
                .isEqualTo("Pleuronectidae spp.");
    }

    @Test
    void createsCursorIndexesAndKeepsFishReviewStatEqualToLiveAggregates() {
        List<String> statColumns = jdbcTemplate.queryForList(
                """
                SELECT column_name
                FROM information_schema.columns
                WHERE table_schema = 'public'
                  AND table_name = 'fish_review_stat'
                ORDER BY ordinal_position
                """,
                String.class);
        Map<String, String> indexDefinitions = jdbcTemplate.query(
                """
                SELECT indexname, indexdef
                FROM pg_indexes
                WHERE schemaname = 'public'
                  AND indexname IN (
                      'idx_review_fish_created_id',
                      'idx_review_fish_helpful_created_id',
                      'idx_fish_name_id',
                      'idx_fish_review_stat_popular')
                """,
                resultSet -> {
                    Map<String, String> definitions = new LinkedHashMap<>();
                    while (resultSet.next()) {
                        definitions.put(resultSet.getString("indexname"), resultSet.getString("indexdef"));
                    }
                    return definitions;
                });

        assertThat(statColumns).containsExactly(
                "fish_id",
                "review_count",
                "rating_count",
                "rating_sum",
                "rating_1_count",
                "rating_2_count",
                "rating_3_count",
                "rating_4_count",
                "rating_5_count",
                "updated_at");
        assertThat(indexDefinitions.keySet()).containsExactlyInAnyOrder(
                "idx_review_fish_created_id",
                "idx_review_fish_helpful_created_id",
                "idx_fish_name_id",
                "idx_fish_review_stat_popular");
        assertThat(indexDefinitions.get("idx_review_fish_created_id"))
                .contains("fish_id", "created_at DESC", "id DESC");
        assertThat(indexDefinitions.get("idx_review_fish_helpful_created_id"))
                .contains("fish_id", "helpful_count DESC", "created_at DESC", "id DESC");

        Integer mismatchesBefore = jdbcTemplate.queryForObject(
                """
                SELECT count(*)
                FROM fish f
                LEFT JOIN fish_review_stat stat ON stat.fish_id = f.id
                LEFT JOIN (
                    SELECT fish_id,
                           count(*) AS review_count,
                           count(rating) AS rating_count,
                           coalesce(sum(rating), 0) AS rating_sum
                    FROM review
                    GROUP BY fish_id
                ) live ON live.fish_id = f.id
                WHERE coalesce(stat.review_count, 0) <> coalesce(live.review_count, 0)
                   OR coalesce(stat.rating_count, 0) <> coalesce(live.rating_count, 0)
                   OR coalesce(stat.rating_sum, 0) <> coalesce(live.rating_sum, 0)
                """,
                Integer.class);
        assertThat(mismatchesBefore).isZero();

        String marker = "b1stat-" + UUID.randomUUID().toString().substring(0, 8);
        try {
            jdbcTemplate.update(
                    """
                    INSERT INTO review (fish_id, nickname, rating, content, created_at)
                    VALUES (1, ?, 5, 'B1 trigger rating review', now())
                    """,
                    marker + "-rated");
            jdbcTemplate.update(
                    """
                    INSERT INTO review (fish_id, nickname, rating, content, created_at)
                    VALUES (1, ?, NULL, 'B1 trigger ratingless review', now())
                    """,
                    marker + "-ratingless");

            Map<String, Object> aggregate = jdbcTemplate.queryForMap(
                    """
                    SELECT stat.review_count,
                           stat.rating_count,
                           stat.rating_sum,
                           stat.rating_5_count,
                           live.review_count AS live_review_count,
                           live.rating_count AS live_rating_count,
                           live.rating_sum AS live_rating_sum
                    FROM fish_review_stat stat
                    JOIN (
                        SELECT fish_id,
                               count(*) AS review_count,
                               count(rating) AS rating_count,
                               coalesce(sum(rating), 0) AS rating_sum
                        FROM review
                        WHERE fish_id = 1
                        GROUP BY fish_id
                    ) live ON live.fish_id = stat.fish_id
                    WHERE stat.fish_id = 1
                    """);
            assertThat(aggregate.get("review_count")).isEqualTo(aggregate.get("live_review_count"));
            assertThat(aggregate.get("rating_count")).isEqualTo(aggregate.get("live_rating_count"));
            assertThat(aggregate.get("rating_sum")).isEqualTo(aggregate.get("live_rating_sum"));
            assertThat(((Number) aggregate.get("rating_5_count")).longValue()).isPositive();
        } finally {
            jdbcTemplate.update("DELETE FROM review WHERE nickname LIKE ?", marker + "%");
        }

        List<String> latestPlan = new TransactionTemplate(transactionManager).execute(status -> {
            jdbcTemplate.execute("SET LOCAL enable_seqscan = off");
            return jdbcTemplate.queryForList(
                    """
                    EXPLAIN (COSTS OFF)
                    SELECT id
                    FROM review
                    WHERE fish_id = 1
                    ORDER BY created_at DESC, id DESC
                    LIMIT 20
                    """,
                    String.class);
        });
        List<String> helpfulPlan = new TransactionTemplate(transactionManager).execute(status -> {
            jdbcTemplate.execute("SET LOCAL enable_seqscan = off");
            return jdbcTemplate.queryForList(
                    """
                    EXPLAIN (COSTS OFF)
                    SELECT id
                    FROM review
                    WHERE fish_id = 1
                    ORDER BY helpful_count DESC, created_at DESC, id DESC
                    LIMIT 20
                    """,
                    String.class);
        });
        assertThat(String.join("\n", latestPlan)).contains("idx_review_fish_created_id");
        assertThat(String.join("\n", helpfulPlan)).contains("idx_review_fish_helpful_created_id");
    }

    @Test
    void claimsAndFinalizesAnExpiredImageWithPostgreSqlSkipLocked() {
        UUID assetId = UUID.fromString("8f38554f-9ee2-4ca5-8d9f-f92281f22aaa");
        String publicId = "fishnote/reviews/" + assetId;
        OffsetDateTime now = OffsetDateTime.of(
                2026, 7, 22, 12, 0, 0, 0, ZoneOffset.UTC);
        jdbcTemplate.update(
                """
                INSERT INTO review_image_asset (
                    id, public_id, secure_url, uploader_key, status,
                    expires_at, upload_completed_at, created_at, updated_at)
                VALUES (?, ?, ?, ?, 'PENDING', ?, ?, ?, ?)
                """,
                assetId,
                publicId,
                "https://res.cloudinary.com/test-cloud/image/upload/" + publicId + ".jpg",
                "v1:7c9e76c7fe3a8c9d7c9e76c7fe3a8c9d7c9e76c7fe3a8c9d7c9e76c7fe3a8c9d",
                now.minusSeconds(1),
                now.minusMinutes(2),
                now.minusHours(1),
                now.minusMinutes(2));

        try {
            var claim = imageAssetCleanupPersistenceService.claimBatch(
                            now,
                            now.minusMinutes(10),
                            now.minusMinutes(15),
                            now.plusHours(24),
                            10)
                    .stream()
                    .filter(candidate -> candidate.assetId().equals(assetId))
                    .findFirst()
                    .orElseThrow();

            Map<String, Object> state = jdbcTemplate.queryForMap(
                    """
                    SELECT status, deletion_claim_id, cleanup_origin_status, cleanup_attempts
                    FROM review_image_asset
                    WHERE id = ?
                    """,
                    assetId);
            assertThat(state.get("status"))
                    .isEqualTo(ReviewImageAssetStatus.DELETE_PENDING.name());
            assertThat(state.get("deletion_claim_id")).isEqualTo(claim.claimId());
            assertThat(state.get("cleanup_origin_status"))
                    .isEqualTo(ReviewImageAssetStatus.PENDING.name());
            assertThat(state.get("cleanup_attempts")).isEqualTo(1);

            assertThat(imageAssetCleanupPersistenceService.completeDeletion(
                            assetId, claim.claimId()))
                    .isTrue();
            assertThat(jdbcTemplate.queryForObject(
                    "SELECT count(*) FROM review_image_asset WHERE id = ?",
                    Long.class,
                    assetId)).isZero();
        } finally {
            jdbcTemplate.update("DELETE FROM review_image_asset WHERE id = ?", assetId);
        }
    }

    @Test
    void writesCurrentBackendBaselineArtifact() throws Exception {
        EndpointMeasurement listMeasurement = measureEndpoint("/api/v1/fish");
        EndpointMeasurement detailMeasurement = measureEndpoint("/api/v1/fish/1");
        EndpointMeasurement pricesMeasurement = measureEndpoint("/api/v1/fish/1/prices");
        EndpointMeasurement reviewsMeasurement = measureEndpoint("/api/v1/fish/1/reviews");
        EndpointMeasurement sourcesMeasurement = measureEndpoint("/api/v1/fish/1/sources");
        CatalogBaseline catalog = catalogBaseline(listMeasurement.payload());

        Map<String, EndpointBaseline> endpoints = new LinkedHashMap<>();
        endpoints.put("fishList", listMeasurement.baseline());
        endpoints.put("fishDetail", detailMeasurement.baseline());
        endpoints.put("fishPrices", pricesMeasurement.baseline());
        endpoints.put("fishReviews", reviewsMeasurement.baseline());
        endpoints.put("fishSources", sourcesMeasurement.baseline());

        BackendBaseline baseline = new BackendBaseline(
                Instant.now().toString(),
                "LOOPBACK_HTTP",
                "PostgreSQL " + jdbcTemplate.queryForObject("SHOW server_version", String.class)
                        + " (Testcontainers)",
                endpoints,
                catalog,
                sourceVerificationBaseline(catalog.catalogCount()));

        assertValidBaseline(baseline);
        Files.createDirectories(BASELINE_ARTIFACT.getParent());
        Files.writeString(
                BASELINE_ARTIFACT,
                objectMapper.writerWithDefaultPrettyPrinter().writeValueAsString(baseline),
                StandardCharsets.UTF_8);

        assertThat(BASELINE_ARTIFACT).isRegularFile();
        JsonNode persisted = objectMapper.readTree(BASELINE_ARTIFACT.toFile());
        for (String endpointName : List.of(
                "fishList", "fishDetail", "fishPrices", "fishReviews", "fishSources")) {
            JsonNode endpoint = persisted.path("endpoints").path(endpointName);
            assertThat(endpoint.path("warmP50Ms").isNumber()).isTrue();
            assertThat(endpoint.path("warmP95Ms").isNumber()).isTrue();
            assertThat(endpoint.path("sqlStatementCount").isIntegralNumber()).isTrue();
            assertThat(endpoint.path("payloadBytes").asInt()).isPositive();
        }
        assertThat(persisted.path("catalog").path("catalogCount").asInt()).isPositive();
        assertThat(persisted.path("sourceVerification").path("implemented").asBoolean())
                .isTrue();
        JsonNode sourceVerification = persisted.path("sourceVerification");
        assertThat(sourceVerification.path("status").asText()).isEqualTo("PARTIAL");
        assertThat(sourceVerification.path("verifiedCount").asInt()).isEqualTo(8);
        assertThat(sourceVerification.path("verificationRate").asDouble())
                .isEqualTo(0.307692);
    }

    private EndpointMeasurement measureEndpoint(String path) throws Exception {
        for (int i = 0; i < WARMUP_REQUESTS; i++) {
            performRequest(path);
        }

        List<RequestSample> samples = new ArrayList<>();
        for (int i = 0; i < SAMPLE_REQUESTS; i++) {
            long statementsBefore = sqlExecutionCounter.total();
            long startedAt = System.nanoTime();
            byte[] payload = performRequest(path);
            long elapsedNanos = System.nanoTime() - startedAt;
            samples.add(new RequestSample(
                    elapsedNanos,
                    sqlExecutionCounter.total() - statementsBefore,
                    payload));
        }

        List<Long> elapsedNanos = samples.stream()
                .map(RequestSample::elapsedNanos)
                .sorted(Comparator.naturalOrder())
                .toList();
        RequestSample representative = samples.get(samples.size() - 1);
        // Keep the worst observed per-request count as a baseline, not as a pass/fail budget.
        long statementCount = samples.stream()
                .mapToLong(RequestSample::sqlStatementCount)
                .max()
                .orElseThrow();

        EndpointBaseline baseline = new EndpointBaseline(
                path,
                WARMUP_REQUESTS,
                SAMPLE_REQUESTS,
                percentileMillis(elapsedNanos, 0.50),
                percentileMillis(elapsedNanos, 0.95),
                statementCount,
                representative.payload().length);
        return new EndpointMeasurement(baseline, representative.payload());
    }

    private byte[] performRequest(String path) throws Exception {
        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create("http://127.0.0.1:" + serverPort + path))
                .header("Accept", "application/json")
                .GET()
                .build();
        HttpResponse<byte[]> response = HTTP_CLIENT.send(
                request,
                HttpResponse.BodyHandlers.ofByteArray());
        assertThat(response.statusCode()).isEqualTo(200);
        return response.body();
    }

    private CatalogBaseline catalogBaseline(byte[] payload) throws Exception {
        JsonNode fishes = objectMapper.readTree(payload);
        assertThat(fishes.isArray()).isTrue();

        int catalogCount = fishes.size();
        int missingImageCount = 0;
        for (JsonNode fish : fishes) {
            JsonNode imageUrl = fish.get("imageUrl");
            if (imageUrl == null || imageUrl.isNull() || imageUrl.asText().isBlank()) {
                missingImageCount++;
            }
        }

        double missingImageRate = catalogCount == 0
                ? 0.0
                : round((double) missingImageCount / catalogCount, 6);
        return new CatalogBaseline(catalogCount, missingImageCount, missingImageRate);
    }

    private SourceVerificationBaseline sourceVerificationBaseline(int catalogCount) {
        Integer verifiedCount = jdbcTemplate.queryForObject(
                """
                SELECT count(DISTINCT fish_id)
                FROM fish_source
                WHERE confidence = 'HIGH'
                  AND claim_type = 'SEASON'
                """,
                Integer.class);
        int count = verifiedCount == null ? 0 : verifiedCount;
        String status = count == 0
                ? "EMPTY"
                : count == catalogCount ? "COMPLETE" : "PARTIAL";
        double verificationRate = catalogCount == 0
                ? 0.0
                : round((double) count / catalogCount, 6);
        return new SourceVerificationBaseline(true, status, count, verificationRate);
    }

    private void assertValidBaseline(BackendBaseline baseline) {
        assertThat(baseline.endpoints())
                .containsKeys("fishList", "fishDetail", "fishPrices", "fishReviews", "fishSources");
        baseline.endpoints().values().forEach(endpoint -> {
            assertThat(endpoint.warmP50Ms()).isGreaterThanOrEqualTo(0.0);
            assertThat(endpoint.warmP95Ms()).isGreaterThanOrEqualTo(endpoint.warmP50Ms());
            assertThat(endpoint.sqlStatementCount()).isGreaterThanOrEqualTo(0L);
            assertThat(endpoint.payloadBytes()).isPositive();
        });
        assertThat(baseline.catalog().catalogCount()).isEqualTo(26);
        assertThat(baseline.catalog().missingRepresentativeImageCount()).isZero();
        assertThat(baseline.catalog().missingRepresentativeImageRate()).isZero();
        assertThat(baseline.sourceVerification().implemented()).isTrue();
        assertThat(baseline.sourceVerification().status()).isEqualTo("PARTIAL");
        assertThat(baseline.sourceVerification().verifiedCount()).isEqualTo(8);
        assertThat(baseline.sourceVerification().verificationRate()).isEqualTo(0.307692);
    }

    private double percentileMillis(List<Long> sortedNanos, double percentile) {
        int index = Math.max(0, (int) Math.ceil(sortedNanos.size() * percentile) - 1);
        return round(sortedNanos.get(index) / 1_000_000.0, 3);
    }

    private double round(double value, int decimalPlaces) {
        double factor = Math.pow(10, decimalPlaces);
        return Math.round(value * factor) / factor;
    }

    private record RequestSample(long elapsedNanos, long sqlStatementCount, byte[] payload) {
    }

    private record EndpointMeasurement(EndpointBaseline baseline, byte[] payload) {
    }

    private record EndpointBaseline(
            String path,
            int warmupRequests,
            int sampleRequests,
            double warmP50Ms,
            double warmP95Ms,
            long sqlStatementCount,
            int payloadBytes) {
    }

    private record CatalogBaseline(
            int catalogCount,
            int missingRepresentativeImageCount,
            double missingRepresentativeImageRate) {
    }

    @JsonInclude(JsonInclude.Include.ALWAYS)
    private record SourceVerificationBaseline(
            boolean implemented,
            String status,
            Integer verifiedCount,
            Double verificationRate) {
    }

    private record SeededFishSource(
            long fishId,
            String claimType,
            String publisher,
            String title,
            String url,
            LocalDate publishedAt,
            OffsetDateTime verifiedAt,
            String license,
            String confidence) {
    }

    private record LegacyFishImageRow(
            long id,
            long fishId,
            int imageOrder,
            String role,
            String url,
            String alt,
            Integer width,
            Integer height) {
    }

    private record BackendBaseline(
            String generatedAt,
            String measurementMode,
            String database,
            Map<String, EndpointBaseline> endpoints,
            CatalogBaseline catalog,
            SourceVerificationBaseline sourceVerification) {
    }
}
