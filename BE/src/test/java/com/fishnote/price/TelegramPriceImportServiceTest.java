package com.fishnote.price;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InOrder;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.core.annotation.AnnotationUtils;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronizationManager;

@ExtendWith(MockitoExtension.class)
class TelegramPriceImportServiceTest {

    @Mock
    private ShopPriceParser parser;

    @Mock
    private PriceImportPersistenceService persistenceService;

    @Test
    void parsesBeforeDelegatingToTheTransactionalPersistenceBoundary() throws Exception {
        OffsetDateTime observedAt = OffsetDateTime.parse("2026-07-22T08:00:00+09:00");
        ParsedShopPrice row = row(observedAt);
        TelegramPriceImportResponse response =
                new TelegramPriceImportResponse(1, 1, List.of("윤호수산"));
        when(parser.parse("시세표", observedAt)).thenAnswer(invocation -> {
            assertThat(TransactionSynchronizationManager.isActualTransactionActive()).isFalse();
            return List.of(row);
        });
        when(persistenceService.persist(List.of(row), List.of("윤호수산"), "1234"))
                .thenReturn(response);
        TelegramPriceImportService service =
                new TelegramPriceImportService(parser, persistenceService);

        assertThat(service.importText("시세표", observedAt, "1234")).isSameAs(response);

        InOrder order = inOrder(parser, persistenceService);
        order.verify(parser).parse("시세표", observedAt);
        order.verify(persistenceService).persist(List.of(row), List.of("윤호수산"), "1234");
        assertThat(AnnotationUtils.findAnnotation(
                        TelegramPriceImportService.class.getMethod(
                                "importText", String.class, OffsetDateTime.class, String.class),
                        Transactional.class))
                .isNull();
        assertThat(AnnotationUtils.findAnnotation(
                        PriceImportPersistenceService.class.getMethod(
                                "persist", List.class, List.class, String.class),
                        Transactional.class))
                .isNotNull();
    }

    @Test
    void bulkFlagOffUsesTheBoundedLegacyPersistencePath() {
        OffsetDateTime observedAt = OffsetDateTime.parse("2026-07-22T08:00:00+09:00");
        ParsedShopPrice row = row(observedAt);
        TelegramPriceImportResponse response =
                new TelegramPriceImportResponse(1, 1, List.of("윤호수산"));
        when(parser.parse("시세표", observedAt)).thenReturn(List.of(row));
        when(persistenceService.persistLegacy(List.of(row), List.of("윤호수산"), "1234"))
                .thenReturn(response);
        TelegramPriceImportService service =
                new TelegramPriceImportService(parser, persistenceService, false);

        assertThat(service.importText("시세표", observedAt, "1234")).isSameAs(response);

        verify(persistenceService).persistLegacy(List.of(row), List.of("윤호수산"), "1234");
        verify(persistenceService, never()).persist(
                org.mockito.ArgumentMatchers.anyList(),
                org.mockito.ArgumentMatchers.anyList(),
                org.mockito.ArgumentMatchers.any());
    }

    private ParsedShopPrice row(OffsetDateTime observedAt) {
        return new ParsedShopPrice(
                observedAt,
                "telegram_bot",
                "윤호수산",
                null,
                "광어",
                "광어",
                "양식",
                "제주",
                "2kg",
                "kg",
                30_000,
                32_000,
                new BigDecimal("0.90"),
                "광어2kg 30000~32000");
    }
}
