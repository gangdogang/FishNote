package com.fishnote.price;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestTemplate;

@ExtendWith(MockitoExtension.class)
class TelegramBotClientTest {

    private static final String TOKEN = "123456:super-secret-token";

    @Mock
    private RestTemplate restTemplate;

    @Test
    void sendsOnlyTheExpectedChatAndTextPayload() {
        TelegramBotClient client = new TelegramBotClient(TOKEN, restTemplate);
        when(restTemplate.postForEntity(any(String.class), any(), eq(String.class)))
                .thenReturn(ResponseEntity.ok("ok"));

        client.sendMessage("42", "3건을 저장했습니다.");

        @SuppressWarnings("unchecked")
        ArgumentCaptor<Map<String, Object>> body = ArgumentCaptor.forClass(Map.class);
        verify(restTemplate).postForEntity(
                eq("https://api.telegram.org/bot" + TOKEN + "/sendMessage"),
                body.capture(),
                eq(String.class));
        assertThat(body.getValue()).containsExactly(
                Map.entry("chat_id", "42"),
                Map.entry("text", "3건을 저장했습니다."));
    }

    @Test
    void failureLogNeverContainsTheTokenUriOrRemoteMessage() {
        TelegramBotClient client = new TelegramBotClient(TOKEN, restTemplate);
        String sensitiveMessage =
                "I/O error on POST request for https://api.telegram.org/bot" + TOKEN + "/sendMessage";
        when(restTemplate.postForEntity(any(String.class), any(), eq(String.class)))
                .thenThrow(new ResourceAccessException(sensitiveMessage));
        Logger logger = (Logger) LoggerFactory.getLogger(TelegramBotClient.class);
        ListAppender<ILoggingEvent> appender = new ListAppender<>();
        appender.start();
        logger.addAppender(appender);

        try {
            client.sendMessage("42", "원문 전체 payload");
        } finally {
            logger.detachAppender(appender);
        }

        assertThat(appender.list).hasSize(1);
        String logged = appender.list.get(0).getFormattedMessage();
        assertThat(logged)
                .contains("ResourceAccessException")
                .doesNotContain(TOKEN)
                .doesNotContain("api.telegram.org")
                .doesNotContain("원문 전체 payload")
                .doesNotContain(sensitiveMessage);
    }

    @Test
    void unexpectedRuntimeFailureIsAlsoBestEffort() {
        TelegramBotClient client = new TelegramBotClient(TOKEN, restTemplate);
        when(restTemplate.postForEntity(any(String.class), any(), eq(String.class)))
                .thenThrow(new IllegalArgumentException(
                        "invalid URI https://api.telegram.org/bot" + TOKEN));

        client.sendMessage("42", "reply payload");

        verify(restTemplate).postForEntity(any(String.class), any(), eq(String.class));
    }

    @Test
    void missingTokenOrChatIdSkipsTheHttpCall() {
        new TelegramBotClient("", restTemplate).sendMessage("42", "reply");
        new TelegramBotClient(TOKEN, restTemplate).sendMessage("", "reply");

        verify(restTemplate, never()).postForEntity(any(String.class), any(), eq(String.class));
    }

    @Test
    void malformedNonBlankTokenFailsWithoutEchoingTheSecret() {
        assertThatThrownBy(() -> new TelegramBotClient("bad token/with spaces", restTemplate))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("Telegram bot token 형식이 올바르지 않습니다.")
                .hasMessageNotContaining("bad token");
    }
}
