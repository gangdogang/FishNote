package com.fishnote.observability;

import java.util.concurrent.atomic.AtomicLong;
import org.springframework.stereotype.Component;

/** Fixed-memory process total used for controlled before/after measurements. */
@Component
public final class SqlExecutionCounter {

    private final AtomicLong total = new AtomicLong();

    void record(SqlOperation operation, long durationNanos) {
        total.updateAndGet(current -> current == Long.MAX_VALUE ? current : current + 1);
        RequestSqlStatementCount.record(operation, durationNanos);
    }

    public long total() {
        return total.get();
    }
}
