package com.fishnote.price;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.reset;
import static org.mockito.Mockito.verify;

import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.transaction.support.TransactionTemplate;

@SpringBootTest
@ActiveProfiles("test")
class TelegramReplyEventIntegrationTest {

    @Autowired
    private ApplicationEventPublisher eventPublisher;

    @Autowired
    private PlatformTransactionManager transactionManager;

    @MockitoBean
    private TelegramBotClient telegramBotClient;

    @BeforeEach
    void setUp() {
        reset(telegramBotClient);
    }

    @Test
    void sendsOnAsyncExecutorOnlyAfterCommitAndWithoutDatabaseTransaction() throws Exception {
        CountDownLatch sent = new CountDownLatch(1);
        AtomicBoolean transactionActive = new AtomicBoolean(true);
        AtomicReference<String> threadName = new AtomicReference<>();
        doAnswer(invocation -> {
                    transactionActive.set(TransactionSynchronizationManager.isActualTransactionActive());
                    threadName.set(Thread.currentThread().getName());
                    sent.countDown();
                    return null;
                })
                .when(telegramBotClient)
                .sendMessage("1234", "완료");

        new TransactionTemplate(transactionManager).executeWithoutResult(status ->
                eventPublisher.publishEvent(new TelegramReplyRequested("1234", "완료")));

        assertThat(sent.await(2, TimeUnit.SECONDS)).isTrue();
        assertThat(transactionActive.get()).isFalse();
        assertThat(threadName.get()).startsWith("telegram-reply-");
    }

    @Test
    void doesNotSendWhenTransactionRollsBack() {
        new TransactionTemplate(transactionManager).executeWithoutResult(status -> {
            eventPublisher.publishEvent(new TelegramReplyRequested("1234", "완료"));
            status.setRollbackOnly();
        });

        verify(telegramBotClient, org.mockito.Mockito.after(500).never())
                .sendMessage(org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any());
    }
}
