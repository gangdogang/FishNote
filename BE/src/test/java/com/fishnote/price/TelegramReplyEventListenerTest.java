package com.fishnote.price;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

import java.lang.reflect.Method;
import org.junit.jupiter.api.Test;
import org.springframework.core.annotation.AnnotationUtils;
import org.springframework.scheduling.annotation.Async;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

class TelegramReplyEventListenerTest {

    @Test
    void sendsValidReply() {
        TelegramBotClient botClient = org.mockito.Mockito.mock(TelegramBotClient.class);
        TelegramReplyEventListener listener = new TelegramReplyEventListener(botClient);

        listener.sendAfterCommit(new TelegramReplyRequested("1234", "완료"));

        verify(botClient).sendMessage("1234", "완료");
    }

    @Test
    void swallowsBotFailureBecauseImportIsAlreadyCommitted() {
        TelegramBotClient botClient = org.mockito.Mockito.mock(TelegramBotClient.class);
        doThrow(new IllegalStateException("sensitive-upstream-body"))
                .when(botClient)
                .sendMessage("1234", "완료");
        TelegramReplyEventListener listener = new TelegramReplyEventListener(botClient);

        assertThatCode(() -> listener.sendAfterCommit(new TelegramReplyRequested("1234", "완료")))
                .doesNotThrowAnyException();
    }

    @Test
    void ignoresInvalidReplyAndDeclaresAsyncAfterCommitContract() throws Exception {
        TelegramBotClient botClient = org.mockito.Mockito.mock(TelegramBotClient.class);
        TelegramReplyEventListener listener = new TelegramReplyEventListener(botClient);

        listener.sendAfterCommit(new TelegramReplyRequested(" ", "완료"));

        verify(botClient, never()).sendMessage(org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any());

        Method method = TelegramReplyEventListener.class.getMethod(
                "sendAfterCommit", TelegramReplyRequested.class);
        Async async = AnnotationUtils.findAnnotation(method, Async.class);
        TransactionalEventListener transactionalEventListener =
                AnnotationUtils.findAnnotation(method, TransactionalEventListener.class);
        assertThat(async).isNotNull();
        assertThat(async.value()).isEqualTo("telegramReplyExecutor");
        assertThat(transactionalEventListener).isNotNull();
        assertThat(transactionalEventListener.phase()).isEqualTo(TransactionPhase.AFTER_COMMIT);
        assertThat(transactionalEventListener.fallbackExecution()).isTrue();
    }
}
