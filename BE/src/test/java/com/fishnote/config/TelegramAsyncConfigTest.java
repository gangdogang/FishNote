package com.fishnote.config;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executor;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.Test;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

class TelegramAsyncConfigTest {

    @Test
    void createsBoundedExecutorAndDropsExcessWorkWithoutThrowing() throws Exception {
        Executor configured = new TelegramAsyncConfig().telegramReplyExecutor(1, 1, 1);
        ThreadPoolTaskExecutor executor = (ThreadPoolTaskExecutor) configured;
        executor.initialize();
        CountDownLatch started = new CountDownLatch(1);
        CountDownLatch release = new CountDownLatch(1);

        try {
            executor.execute(() -> {
                started.countDown();
                try {
                    release.await(2, TimeUnit.SECONDS);
                } catch (InterruptedException ex) {
                    Thread.currentThread().interrupt();
                }
            });
            assertThat(started.await(2, TimeUnit.SECONDS)).isTrue();
            executor.execute(() -> {});

            assertThat(executor.getThreadPoolExecutor().getQueue().remainingCapacity()).isZero();
            assertThatCode(() -> executor.execute(() -> {})).doesNotThrowAnyException();
            assertThat(executor.getThreadNamePrefix()).isEqualTo("telegram-reply-");
        } finally {
            release.countDown();
            executor.shutdown();
        }
    }

    @Test
    void rejectsInvalidPoolConfiguration() {
        TelegramAsyncConfig config = new TelegramAsyncConfig();

        assertThatThrownBy(() -> config.telegramReplyExecutor(0, 1, 1))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> config.telegramReplyExecutor(2, 1, 1))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> config.telegramReplyExecutor(1, 1, -1))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> config.telegramReplyExecutor(5, 5, 1))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> config.telegramReplyExecutor(1, 9, 1))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> config.telegramReplyExecutor(1, 1, 1_001))
                .isInstanceOf(IllegalArgumentException.class);

        assertThatCode(() -> config.telegramReplyExecutor(4, 8, 1_000))
                .doesNotThrowAnyException();
    }
}
