package com.fishnote.observability;

import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Timer;
import java.io.IOException;
import java.net.http.HttpTimeoutException;
import java.util.Locale;
import java.util.Objects;
import java.util.concurrent.TimeoutException;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.function.Supplier;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/** Records bounded external-call outcomes without retaining URLs, tokens, or payloads. */
@Component
public class ExternalApiMetrics {

    static final String DURATION_METRIC = "fishnote.external.api.duration";
    static final String TIMEOUT_METRIC = "fishnote.external.api.timeouts";

    private static final Logger log = LoggerFactory.getLogger(ExternalApiMetrics.class);

    private final MeterRegistry meterRegistry;
    private final AtomicBoolean metricFailureLogged = new AtomicBoolean();

    public ExternalApiMetrics(MeterRegistry meterRegistry) {
        this.meterRegistry = meterRegistry;
    }

    public <T> T record(String provider, String operation, Supplier<T> call) {
        String safeProvider = boundedTag(provider);
        String safeOperation = boundedTag(operation);
        Supplier<T> safeCall = Objects.requireNonNull(call);
        Timer.Sample sample = startTimer();
        String outcome = "success";
        try {
            return safeCall.get();
        } catch (RuntimeException exception) {
            if (isTimeout(exception)) {
                outcome = "timeout";
                recordTimeout(safeProvider, safeOperation);
            } else {
                outcome = "error";
            }
            throw exception;
        } finally {
            stopTimer(sample, safeProvider, safeOperation, outcome);
        }
    }

    /** Variant for SDK clients such as Cloudinary whose transport API exposes checked I/O errors. */
    public <T> T recordIo(String provider, String operation, IoSupplier<T> call) throws IOException {
        String safeProvider = boundedTag(provider);
        String safeOperation = boundedTag(operation);
        IoSupplier<T> safeCall = Objects.requireNonNull(call);
        Timer.Sample sample = startTimer();
        String outcome = "success";
        try {
            return safeCall.get();
        } catch (IOException | RuntimeException exception) {
            if (isTimeout(exception)) {
                outcome = "timeout";
                recordTimeout(safeProvider, safeOperation);
            } else {
                outcome = "error";
            }
            throw exception;
        } finally {
            stopTimer(sample, safeProvider, safeOperation, outcome);
        }
    }

    @FunctionalInterface
    public interface IoSupplier<T> {
        T get() throws IOException;
    }

    private Timer.Sample startTimer() {
        try {
            return Timer.start(meterRegistry);
        } catch (RuntimeException exception) {
            warnOnce(exception);
            return null;
        }
    }

    private void recordTimeout(String provider, String operation) {
        try {
            meterRegistry.counter(
                            TIMEOUT_METRIC,
                            "provider", provider,
                            "operation", operation)
                    .increment();
        } catch (RuntimeException exception) {
            warnOnce(exception);
        }
    }

    private void stopTimer(Timer.Sample sample, String provider, String operation, String outcome) {
        if (sample == null) {
            return;
        }
        try {
            sample.stop(Timer.builder(DURATION_METRIC)
                    .description("External API latency with bounded non-sensitive tags")
                    .tags(
                            "provider", provider,
                            "operation", operation,
                            "outcome", outcome)
                    .register(meterRegistry));
        } catch (RuntimeException exception) {
            warnOnce(exception);
        }
    }

    private void warnOnce(RuntimeException exception) {
        if (metricFailureLogged.compareAndSet(false, true)) {
            log.warn(
                    "External API metric recording failed; further warnings are suppressed. errorType={}",
                    exception.getClass().getSimpleName());
        }
    }

    private boolean isTimeout(Throwable throwable) {
        Throwable current = throwable;
        for (int depth = 0; current != null && depth < 8; depth++) {
            if (current instanceof java.net.SocketTimeoutException
                    || current instanceof HttpTimeoutException
                    || current instanceof TimeoutException
                    || current.getClass().getSimpleName().toLowerCase(Locale.ROOT).contains("timeout")) {
                return true;
            }
            current = current.getCause();
        }
        return false;
    }

    private String boundedTag(String value) {
        String tag = Objects.requireNonNullElse(value, "unknown")
                .trim()
                .toLowerCase(Locale.ROOT);
        return tag.matches("[a-z0-9_-]{1,32}") ? tag : "other";
    }
}
