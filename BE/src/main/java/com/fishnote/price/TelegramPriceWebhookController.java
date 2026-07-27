package com.fishnote.price;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.MissingNode;
import com.fishnote.common.UnauthorizedException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.util.List;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/integrations/telegram")
public class TelegramPriceWebhookController {

    private static final String TELEGRAM_SECRET_HEADER = "X-Telegram-Bot-Api-Secret-Token";

    private final TelegramPriceWebhookService telegramPriceWebhookService;
    private final String webhookSecret;

    public TelegramPriceWebhookController(
            TelegramPriceWebhookService telegramPriceWebhookService,
            @Value("${app.telegram.webhook-secret:}") String webhookSecret) {
        this.telegramPriceWebhookService = telegramPriceWebhookService;
        this.webhookSecret = webhookSecret;
    }

    @PostMapping("/price-updates")
    public ResponseEntity<TelegramPriceImportResponse> receivePriceUpdate(
            @RequestHeader HttpHeaders headers, @RequestBody JsonNode update) {
        verifySecret(headers.getFirst(TELEGRAM_SECRET_HEADER));

        JsonNode message = extractMessage(update);
        String text = extractText(message);
        TelegramPriceImportResponse response = telegramPriceWebhookService.importAndQueueReply(
                text,
                extractObservedAt(message),
                extractChatId(message));
        return ResponseEntity.ok(response);
    }

    private void verifySecret(String requestSecret) {
        if (webhookSecret == null || webhookSecret.isBlank()) {
            throw new UnauthorizedException("TELEGRAM_WEBHOOK_SECRET is not configured.");
        }
        // 시크릿 비교는 타이밍 사이드채널 방지를 위해 상수 시간 비교 사용
        byte[] expected = webhookSecret.getBytes(StandardCharsets.UTF_8);
        byte[] actual = requestSecret == null ? new byte[0] : requestSecret.getBytes(StandardCharsets.UTF_8);
        if (!MessageDigest.isEqual(expected, actual)) {
            throw new UnauthorizedException("Invalid Telegram webhook secret.");
        }
    }

    private JsonNode extractMessage(JsonNode update) {
        for (String field : List.of("message", "edited_message", "channel_post", "edited_channel_post")) {
            JsonNode message = update.path(field);
            if (!message.isMissingNode() && !message.isNull()) {
                return message;
            }
        }
        return MissingNode.getInstance();
    }

    private String extractText(JsonNode message) {
        if (message.path("text").isTextual()) {
            return message.path("text").asText();
        }
        if (message.path("caption").isTextual()) {
            return message.path("caption").asText();
        }
        return "";
    }

    private OffsetDateTime extractObservedAt(JsonNode message) {
        if (message.path("date").canConvertToLong()) {
            return Instant.ofEpochSecond(message.path("date").asLong()).atOffset(ShopPriceParser.KST);
        }
        return OffsetDateTime.now(ShopPriceParser.KST);
    }

    private String extractChatId(JsonNode message) {
        JsonNode chatId = message.path("chat").path("id");
        return chatId.canConvertToLong() ? String.valueOf(chatId.asLong()) : null;
    }
}
