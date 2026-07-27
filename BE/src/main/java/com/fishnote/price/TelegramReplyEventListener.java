package com.fishnote.price;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

@Component
public class TelegramReplyEventListener {

    private static final Logger log = LoggerFactory.getLogger(TelegramReplyEventListener.class);

    private final TelegramBotClient telegramBotClient;

    public TelegramReplyEventListener(TelegramBotClient telegramBotClient) {
        this.telegramBotClient = telegramBotClient;
    }

    @Async("telegramReplyExecutor")
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    public void sendAfterCommit(TelegramReplyRequested event) {
        if (event == null
                || event.chatId() == null
                || event.chatId().isBlank()
                || event.text() == null
                || event.text().isBlank()) {
            return;
        }
        try {
            telegramBotClient.sendMessage(event.chatId(), event.text());
        } catch (RuntimeException ex) {
            // A reply is best-effort and must never affect an already committed import.
            log.warn(
                    "Telegram after-commit reply failed. errorType={}",
                    ex.getClass().getSimpleName());
        }
    }
}
