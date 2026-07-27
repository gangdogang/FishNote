package com.fishnote.price;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;

import java.lang.reflect.Method;
import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.springframework.core.annotation.AnnotationUtils;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

class PriceImportAfterCommitListenerTest {

    @Test
    void invokesAllHooksAndIsolatesFailures() throws Exception {
        PriceImportAfterCommitHook failing = org.mockito.Mockito.mock(PriceImportAfterCommitHook.class);
        PriceImportAfterCommitHook succeeding = org.mockito.Mockito.mock(PriceImportAfterCommitHook.class);
        PriceImportCommittedEvent event = new PriceImportCommittedEvent(
                Set.of(1L), new TelegramPriceImportResponse(1, 1, List.of("윤호수산")));
        doThrow(new IllegalStateException("cache unavailable")).when(failing).afterCommit(event);
        PriceImportAfterCommitListener listener =
                new PriceImportAfterCommitListener(List.of(failing, succeeding));

        assertThatCode(() -> listener.runAfterCommitHooks(event)).doesNotThrowAnyException();
        verify(failing).afterCommit(event);
        verify(succeeding).afterCommit(event);

        Method method = PriceImportAfterCommitListener.class.getMethod(
                "runAfterCommitHooks", PriceImportCommittedEvent.class);
        TransactionalEventListener annotation =
                AnnotationUtils.findAnnotation(method, TransactionalEventListener.class);
        assertThat(annotation).isNotNull();
        assertThat(annotation.phase()).isEqualTo(TransactionPhase.AFTER_COMMIT);
        assertThat(annotation.fallbackExecution()).isFalse();
    }
}
