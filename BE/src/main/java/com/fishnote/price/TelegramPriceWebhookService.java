package com.fishnote.price;

import java.time.OffsetDateTime;
import java.util.List;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;

@Service
public class TelegramPriceWebhookService {

    private final TelegramPriceImportService telegramPriceImportService;
    private final ApplicationEventPublisher eventPublisher;

    public TelegramPriceWebhookService(
            TelegramPriceImportService telegramPriceImportService,
            ApplicationEventPublisher eventPublisher) {
        this.telegramPriceImportService = telegramPriceImportService;
        this.eventPublisher = eventPublisher;
    }

    public TelegramPriceImportResponse importAndQueueReply(
            String text,
            OffsetDateTime observedAt,
            String chatId) {
        TelegramPriceImportResponse response;
        String replyText;
        if (text == null || text.isBlank()) {
            response = new TelegramPriceImportResponse(0, 0, List.of());
            replyText = "텍스트 시세표를 찾지 못했습니다. 카톡 시세표 전체 텍스트를 그대로 보내주세요.";
        } else {
            // The importer parses outside its inner DB transaction. It queues the reply inside that
            // transaction so the listener can only send it after a successful commit.
            return telegramPriceImportService.importText(text, observedAt, chatId);
        }

        if (chatId != null && !chatId.isBlank()) {
            eventPublisher.publishEvent(new TelegramReplyRequested(chatId, replyText));
        }
        return response;
    }
}
