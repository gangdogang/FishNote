package com.fishnote.price;

import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

@Component
public class PriceImportAfterCommitListener {

    private static final Logger log = LoggerFactory.getLogger(PriceImportAfterCommitListener.class);

    private final List<PriceImportAfterCommitHook> hooks;

    public PriceImportAfterCommitListener(List<PriceImportAfterCommitHook> hooks) {
        this.hooks = List.copyOf(hooks);
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void runAfterCommitHooks(PriceImportCommittedEvent event) {
        for (PriceImportAfterCommitHook hook : hooks) {
            try {
                hook.afterCommit(event);
            } catch (RuntimeException ex) {
                log.warn(
                        "Price import after-commit hook failed. hookType={}, errorType={}",
                        hook.getClass().getName(),
                        ex.getClass().getSimpleName());
            }
        }
    }
}
