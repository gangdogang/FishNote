package com.fishnote.price;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.OffsetDateTime;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.context.ApplicationEventPublisher;

@ExtendWith(MockitoExtension.class)
class TelegramPriceWebhookServiceTest {

    private static final OffsetDateTime OBSERVED_AT = OffsetDateTime.parse("2026-07-22T12:00:00+09:00");

    @Mock
    private TelegramPriceImportService telegramPriceImportService;

    @Mock
    private ApplicationEventPublisher eventPublisher;

    private TelegramPriceWebhookService service;

    @BeforeEach
    void setUp() {
        service = new TelegramPriceWebhookService(telegramPriceImportService, eventPublisher);
    }

    @Test
    void delegatesNonBlankMessageWithReplyContextToTheSeparatedImporter() {
        TelegramPriceImportResponse response =
                new TelegramPriceImportResponse(2, 1, List.of("윤호수산"));
        when(telegramPriceImportService.importText("시세표", OBSERVED_AT, "1234"))
                .thenReturn(response);

        TelegramPriceImportResponse result =
                service.importAndQueueReply("시세표", OBSERVED_AT, "1234");

        assertThat(result).isSameAs(response);
        verify(telegramPriceImportService).importText("시세표", OBSERVED_AT, "1234");
        verify(eventPublisher, never()).publishEvent(org.mockito.ArgumentMatchers.any());
    }

    @Test
    void queuesGuidanceWithoutCallingImporterForBlankMessage() {
        TelegramPriceImportResponse result = service.importAndQueueReply("  ", OBSERVED_AT, "1234");

        assertThat(result)
                .isEqualTo(new TelegramPriceImportResponse(0, 0, List.of()));
        verify(telegramPriceImportService, never()).importText("  ", OBSERVED_AT);
        ArgumentCaptor<TelegramReplyRequested> eventCaptor =
                ArgumentCaptor.forClass(TelegramReplyRequested.class);
        verify(eventPublisher).publishEvent(eventCaptor.capture());
        assertThat(eventCaptor.getValue())
                .isEqualTo(new TelegramReplyRequested(
                        "1234",
                        "텍스트 시세표를 찾지 못했습니다. 카톡 시세표 전체 텍스트를 그대로 보내주세요."));
    }

    @Test
    void doesNotPublishReplyWithoutChatId() {
        TelegramPriceImportResponse response =
                new TelegramPriceImportResponse(0, 0, List.of());
        when(telegramPriceImportService.importText("시세표", OBSERVED_AT, null)).thenReturn(response);

        assertThat(service.importAndQueueReply("시세표", OBSERVED_AT, null)).isSameAs(response);

        verify(eventPublisher, never()).publishEvent(org.mockito.ArgumentMatchers.any());
    }
}
