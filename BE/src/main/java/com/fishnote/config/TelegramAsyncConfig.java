package com.fishnote.config;

import java.util.concurrent.Executor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

@Configuration
@EnableAsync
public class TelegramAsyncConfig {

    private static final Logger log = LoggerFactory.getLogger(TelegramAsyncConfig.class);
    private static final int MAX_CORE_POOL_SIZE = 4;
    private static final int MAX_POOL_SIZE = 8;
    private static final int MAX_QUEUE_CAPACITY = 1_000;

    @Bean("telegramReplyExecutor")
    public Executor telegramReplyExecutor(
            @Value("${app.telegram.reply.core-pool-size:1}") int corePoolSize,
            @Value("${app.telegram.reply.max-pool-size:2}") int maxPoolSize,
            @Value("${app.telegram.reply.queue-capacity:100}") int queueCapacity) {
        if (corePoolSize <= 0
                || corePoolSize > MAX_CORE_POOL_SIZE
                || maxPoolSize < corePoolSize
                || maxPoolSize > MAX_POOL_SIZE
                || queueCapacity < 0
                || queueCapacity > MAX_QUEUE_CAPACITY) {
            throw new IllegalArgumentException("Telegram reply executor 설정이 올바르지 않습니다.");
        }

        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setThreadNamePrefix("telegram-reply-");
        executor.setCorePoolSize(corePoolSize);
        executor.setMaxPoolSize(maxPoolSize);
        executor.setQueueCapacity(queueCapacity);
        // Reply delivery is best-effort. Do not drain a full queue while the application is stopping.
        executor.setWaitForTasksToCompleteOnShutdown(false);
        executor.setAwaitTerminationSeconds(5);
        executor.setRejectedExecutionHandler((task, pool) -> log.warn(
                "Telegram reply queue is full; after-commit reply was dropped."));
        return executor;
    }
}
