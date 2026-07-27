package com.fishnote.observability;

import java.util.ArrayList;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.StringJoiner;

/**
 * Request-local database statement observations.
 *
 * <p>SQL text and bind values are discarded immediately after classification. Samples contain
 * only a fixed operation name and a coarse latency bucket, and are capped at eight entries.</p>
 */
final class RequestSqlStatementCount {

    private static final int MAX_SAMPLES = 8;
    private static final ThreadLocal<State> CURRENT = new ThreadLocal<>();

    private RequestSqlStatementCount() {
    }

    static Scope open() {
        State previous = CURRENT.get();
        State current = new State();
        CURRENT.set(current);
        return new Scope(previous, current);
    }

    static void record(SqlOperation operation, long durationNanos) {
        State state = CURRENT.get();
        if (state == null) {
            return;
        }
        if (state.count < Long.MAX_VALUE) {
            state.count++;
        }
        state.operations.merge(operation, 1L, RequestSqlStatementCount::saturatedAdd);
        if (state.samples.size() < MAX_SAMPLES) {
            state.samples.add(operation.tag() + ':' + latencyBucket(durationNanos));
        } else {
            state.sampleTruncated = true;
        }
    }

    private static long saturatedAdd(long left, long right) {
        return left > Long.MAX_VALUE - right ? Long.MAX_VALUE : left + right;
    }

    private static String latencyBucket(long durationNanos) {
        if (durationNanos < 1_000_000L) {
            return "lt1ms";
        }
        if (durationNanos < 10_000_000L) {
            return "1to10ms";
        }
        if (durationNanos < 100_000_000L) {
            return "10to100ms";
        }
        return "gte100ms";
    }

    private static final class State {
        private long count;
        private final Map<SqlOperation, Long> operations = new EnumMap<>(SqlOperation.class);
        private final List<String> samples = new ArrayList<>(MAX_SAMPLES);
        private boolean sampleTruncated;
    }

    record Snapshot(
            long count,
            String operationCounts,
            List<String> samples,
            boolean sampleTruncated) {
    }

    static final class Scope implements AutoCloseable {

        private final State previous;
        private final State current;
        private boolean closed;

        private Scope(State previous, State current) {
            this.previous = previous;
            this.current = current;
        }

        long count() {
            return current.count;
        }

        Snapshot snapshot() {
            StringJoiner operations = new StringJoiner(",", "{", "}");
            for (SqlOperation operation : SqlOperation.values()) {
                long count = current.operations.getOrDefault(operation, 0L);
                if (count > 0) {
                    operations.add(operation.tag() + '=' + count);
                }
            }
            return new Snapshot(
                    current.count,
                    operations.toString(),
                    List.copyOf(current.samples),
                    current.sampleTruncated);
        }

        @Override
        public void close() {
            if (closed) {
                return;
            }
            closed = true;
            if (previous == null) {
                CURRENT.remove();
            } else {
                CURRENT.set(previous);
            }
        }
    }
}
