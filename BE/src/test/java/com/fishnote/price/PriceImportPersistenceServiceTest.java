package com.fishnote.price;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.reset;
import static org.mockito.Mockito.verify;

import com.fishnote.fish.Fish;
import com.fishnote.fish.FishRepository;
import com.fishnote.observability.SqlExecutionCounter;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.test.context.ActiveProfiles;

@SpringBootTest
@ActiveProfiles("test")
class PriceImportPersistenceServiceTest {

    @Autowired
    private PriceImportPersistenceService persistenceService;

    @Autowired
    private ShopPriceObservationRepository observationRepository;

    @Autowired
    private FishRepository fishRepository;

    @MockBean
    private PriceImportAfterCommitHook afterCommitHook;

    @Autowired
    private SqlExecutionCounter sqlExecutionCounter;

    @BeforeEach
    void setUp() {
        reset(afterCommitHook);
        observationRepository.deleteAll();
        fishRepository.deleteAll();

        Fish fish = new Fish();
        fish.setName("광어");
        fish.setNameEn("Olive flounder");
        fish.setDescription("광어 설명");
        fish.setPriceLevel((short) 2);
        fishRepository.saveAndFlush(fish);
    }

    @Test
    void rejectsMoreThanTwoHundredRowsBeforeWritingOrPublishingCommitEvent() {
        List<ParsedShopPrice> rows = new ArrayList<>();
        OffsetDateTime observedAt = OffsetDateTime.parse("2026-07-22T08:00:00+09:00");
        for (int index = 0; index < 201; index++) {
            rows.add(row(observedAt.plusSeconds(index), null, "🐟".repeat(100) + index, "광어"));
        }
        long statementsBefore = sqlExecutionCounter.total();

        assertThatThrownBy(() -> persistenceService.persist(rows, List.of(), "1234"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("최대 200건");

        assertThat(sqlExecutionCounter.total()).isEqualTo(statementsBefore);
        assertThat(observationRepository.count()).isZero();
        verify(afterCommitHook, org.mockito.Mockito.never())
                .afterCommit(org.mockito.ArgumentMatchers.any());
    }

    @Test
    void rollsBackTheWholeBulkStatementWhenOneRowIsInvalid() {
        OffsetDateTime observedAt = OffsetDateTime.parse("2026-07-22T08:00:00+09:00");
        List<ParsedShopPrice> rows = new ArrayList<>();
        for (int index = 0; index < PriceImportPersistenceService.MAX_INSERT_ROWS - 1; index++) {
            rows.add(row(
                    observedAt.plusSeconds(index),
                    "윤호수산",
                    "정상 " + index,
                    "광어"));
        }
        ParsedShopPrice invalid = new ParsedShopPrice(
                observedAt.plusSeconds(PriceImportPersistenceService.MAX_INSERT_ROWS - 1L),
                "telegram_bot",
                "윤호수산",
                null,
                "광어",
                null,
                "양식",
                "제주",
                "2kg",
                "kg",
                30_000,
                32_000,
                new BigDecimal("0.90"),
                "reported_name 없음");
        rows.add(invalid);

        assertThatThrownBy(() -> persistenceService.persist(
                        rows, List.of("윤호수산"), "1234"))
                .isInstanceOf(DataIntegrityViolationException.class);

        assertThat(observationRepository.count()).isZero();
        verify(afterCommitHook, org.mockito.Mockito.never())
                .afterCommit(org.mockito.ArgumentMatchers.any());
    }

    @Test
    void legacyFallbackAcceptsFiftyRowsDeduplicatesAndRunsAfterCommitHooks() {
        OffsetDateTime observedAt = OffsetDateTime.parse("2026-07-22T08:00:00+09:00");
        List<ParsedShopPrice> rows = new ArrayList<>();
        for (int index = 0; index < PriceImportPersistenceService.MAX_LEGACY_INSERT_ROWS; index++) {
            rows.add(row(observedAt.plusSeconds(index), "윤호수산", "레거시 " + index, "광어"));
        }

        TelegramPriceImportResponse first =
                persistenceService.persistLegacy(rows, List.of("윤호수산"), "1234");
        TelegramPriceImportResponse duplicate =
                persistenceService.persistLegacy(rows, List.of("윤호수산"), null);

        assertThat(first.parsedCount()).isEqualTo(50);
        assertThat(first.savedCount()).isEqualTo(50);
        assertThat(duplicate.parsedCount()).isEqualTo(50);
        assertThat(duplicate.savedCount()).isZero();
        assertThat(observationRepository.count()).isEqualTo(50);
        verify(afterCommitHook, org.mockito.Mockito.times(2))
                .afterCommit(org.mockito.ArgumentMatchers.any(PriceImportCommittedEvent.class));
    }

    @Test
    void legacyFallbackRejectsOversizedWebhookWithoutWritingOrPublishingCommitEvent() {
        OffsetDateTime observedAt = OffsetDateTime.parse("2026-07-22T08:00:00+09:00");
        List<ParsedShopPrice> rows = new ArrayList<>();
        for (int index = 0; index <= PriceImportPersistenceService.MAX_LEGACY_INSERT_ROWS; index++) {
            rows.add(row(observedAt.plusSeconds(index), "윤호수산", "초과 " + index, "광어"));
        }

        assertThatThrownBy(() -> persistenceService.persistLegacy(
                        rows, List.of("윤호수산"), "1234"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("최대 50건");

        assertThat(observationRepository.count()).isZero();
        verify(afterCommitHook, org.mockito.Mockito.never())
                .afterCommit(org.mockito.ArgumentMatchers.any());
    }

    private ParsedShopPrice row(
            OffsetDateTime observedAt,
            String sourceName,
            String rawText,
            String canonicalName) {
        return new ParsedShopPrice(
                observedAt,
                "telegram_bot",
                sourceName,
                null,
                canonicalName,
                canonicalName,
                "양식",
                "제주",
                "2kg",
                "kg",
                30_000,
                32_000,
                new BigDecimal("0.90"),
                rawText);
    }
}
