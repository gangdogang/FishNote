package com.fishnote.price;

import com.fishnote.observability.ExternalApiMetrics;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.regex.Pattern;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

@Service
public class TelegramBotClient {

    private static final Logger log = LoggerFactory.getLogger(TelegramBotClient.class);
    private static final Pattern BOT_TOKEN =
            Pattern.compile("^[0-9]{1,20}:[A-Za-z0-9_-]{10,100}$");

    private final RestTemplate restTemplate;
    private final String botToken;
    private final ExternalApiMetrics externalApiMetrics;

    @Autowired
    public TelegramBotClient(
            @Value("${app.telegram.bot-token:}") String botToken,
            @Qualifier("telegramRestTemplate") RestTemplate restTemplate,
            ExternalApiMetrics externalApiMetrics) {
        this.botToken = botToken;
        this.restTemplate = restTemplate;
        this.externalApiMetrics = externalApiMetrics;
        validateToken(botToken);
    }

    TelegramBotClient(String botToken, RestTemplate restTemplate) {
        this.botToken = botToken;
        this.restTemplate = restTemplate;
        this.externalApiMetrics = null;
        validateToken(botToken);
    }

    private void validateToken(String botToken) {
        if (botToken != null
                && !botToken.isBlank()
                && !BOT_TOKEN.matcher(botToken).matches()) {
            throw new IllegalArgumentException("Telegram bot token 형식이 올바르지 않습니다.");
        }
    }

    public void sendMessage(String chatId, String text) {
        if (botToken == null || botToken.isBlank() || chatId == null || chatId.isBlank()) {
            log.warn("Telegram bot token or chat id is missing; import reply was skipped.");
            return;
        }

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("chat_id", chatId);
        body.put("text", text);

        try {
            observe(() -> restTemplate.postForEntity(
                    "https://api.telegram.org/bot" + botToken + "/sendMessage",
                    body,
                    String.class));
        } catch (RuntimeException ex) {
            // RestTemplate exception messages can embed the request URI, which contains the token.
            log.warn(
                    "Failed to send Telegram import reply. errorType={}",
                    ex.getClass().getSimpleName());
        }
    }

    private void observe(java.util.function.Supplier<?> call) {
        if (externalApiMetrics == null) {
            call.get();
            return;
        }
        externalApiMetrics.record("telegram", "send_message", call);
    }
}
