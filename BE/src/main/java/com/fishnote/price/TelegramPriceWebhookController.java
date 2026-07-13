package com.fishnote.price;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.MissingNode;
import com.fishnote.common.UnauthorizedException;
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

    private final TelegramPriceImportService telegramPriceImportService;
    private final TelegramBotClient telegramBotClient;
    private final String webhookSecret;

    public TelegramPriceWebhookController(
            TelegramPriceImportService telegramPriceImportService,
            TelegramBotClient telegramBotClient,
            @Value("${app.telegram.webhook-secret:}") String webhookSecret) {
        this.telegramPriceImportService = telegramPriceImportService;
        this.telegramBotClient = telegramBotClient;
        this.webhookSecret = webhookSecret;
    }

    @PostMapping("/price-updates")
    public ResponseEntity<TelegramPriceImportResponse> receivePriceUpdate(
            @RequestHeader HttpHeaders headers, @RequestBody JsonNode update) {
        verifySecret(headers.getFirst(TELEGRAM_SECRET_HEADER));

        JsonNode message = extractMessage(update);
        String text = extractText(message);
        if (text.isBlank()) {
            TelegramPriceImportResponse response = new TelegramPriceImportResponse(0, 0, List.of());
            sendReply(message, "텍스트 시세표를 찾지 못했습니다. 카톡 시세표 전체 텍스트를 그대로 보내주세요.");
            return ResponseEntity.ok(response);
        }

        TelegramPriceImportResponse response =
                telegramPriceImportService.importText(text, extractObservedAt(message));
        sendReply(message, replyText(response));
        return ResponseEntity.ok(response);
    }

    private void verifySecret(String requestSecret) {
        if (webhookSecret == null || webhookSecret.isBlank()) {
            throw new UnauthorizedException("TELEGRAM_WEBHOOK_SECRET is not configured.");
        }
        if (!webhookSecret.equals(requestSecret)) {
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

    private void sendReply(JsonNode message, String text) {
        JsonNode chatId = message.path("chat").path("id");
        if (!chatId.canConvertToLong()) {
            return;
        }
        Integer replyToMessageId = message.path("message_id").canConvertToInt()
                ? message.path("message_id").asInt()
                : null;
        telegramBotClient.sendMessage(String.valueOf(chatId.asLong()), text, replyToMessageId);
    }

    private String replyText(TelegramPriceImportResponse response) {
        String sourceNames = response.sourceNames().isEmpty() ? "미확인" : String.join(", ", response.sourceNames());
        if (response.parsedCount() == 0) {
            return "파싱된 시세가 없습니다.\n가게명과 가격 라인이 포함된 시세표 전체 텍스트를 보내주세요.";
        }
        return "시세 저장 완료\n"
                + "- 파싱: " + response.parsedCount() + "건\n"
                + "- 신규 저장: " + response.savedCount() + "건\n"
                + "- 가게: " + sourceNames + "\n"
                + "가게별로 저장했고, 조회 API에서는 전체 합산 그래프 데이터도 제공합니다.";
    }
}
