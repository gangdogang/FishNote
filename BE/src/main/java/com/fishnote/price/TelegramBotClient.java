package com.fishnote.price;

import java.util.LinkedHashMap;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;

@Service
public class TelegramBotClient {

    private static final Logger log = LoggerFactory.getLogger(TelegramBotClient.class);

    private final RestTemplate restTemplate = new RestTemplate();
    private final String botToken;

    public TelegramBotClient(@Value("${app.telegram.bot-token:}") String botToken) {
        this.botToken = botToken;
    }

    public void sendMessage(String chatId, String text, Integer replyToMessageId) {
        if (botToken == null || botToken.isBlank() || chatId == null || chatId.isBlank()) {
            return;
        }

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("chat_id", chatId);
        body.put("text", text);
        if (replyToMessageId != null) {
            body.put("reply_to_message_id", replyToMessageId);
        }

        try {
            restTemplate.postForEntity("https://api.telegram.org/bot" + botToken + "/sendMessage", body, String.class);
        } catch (RestClientException ex) {
            log.warn("Failed to send Telegram import reply: {}", ex.getMessage());
        }
    }
}
