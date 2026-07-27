package com.fishnote.observability;

import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Metrics;
import java.util.EnumMap;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.atomic.AtomicBoolean;
import org.hibernate.cfg.AvailableSettings;
import org.hibernate.resource.jdbc.spi.StatementInspector;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.orm.jpa.HibernatePropertiesCustomizer;
import org.springframework.stereotype.Component;

/**
 * Records aggregate Hibernate operation metrics without retaining SQL text or bind values.
 * Request-local counting happens once at the JDBC execution boundary.
 */
@Component
public final class HibernateSqlObservationInspector
        implements StatementInspector, HibernatePropertiesCustomizer {

    static final String STATEMENT_METRIC = "fishnote.database.hibernate.statements";

    private static final Logger log = LoggerFactory.getLogger(HibernateSqlObservationInspector.class);

    private final Map<Operation, Counter> counters = new EnumMap<>(Operation.class);
    private final AtomicBoolean metricFailureLogged = new AtomicBoolean();

    @Autowired
    public HibernateSqlObservationInspector(ObjectProvider<MeterRegistry> registryProvider) {
        this(registryProvider.getIfAvailable(() -> Metrics.globalRegistry));
    }

    HibernateSqlObservationInspector(MeterRegistry meterRegistry) {
        for (Operation operation : Operation.values()) {
            counters.put(
                    operation,
                    Counter.builder(STATEMENT_METRIC)
                            .description("Hibernate statements grouped by a bounded operation type")
                            .tag("operation", operation.tag)
                            .register(meterRegistry));
        }
    }

    @Override
    public String inspect(String sql) {
        try {
            counters.get(classify(sql)).increment();
        } catch (RuntimeException exception) {
            // Observability must never make a database statement fail. Do not log SQL text.
            if (metricFailureLogged.compareAndSet(false, true)) {
                log.warn(
                        "Hibernate statement metric recording failed; further warnings are suppressed. errorType={}",
                        exception.getClass().getSimpleName());
            }
        }
        return sql;
    }

    @Override
    public void customize(Map<String, Object> hibernateProperties) {
        hibernateProperties.put(AvailableSettings.STATEMENT_INSPECTOR, this);
    }

    private Operation classify(String sql) {
        if (sql == null) {
            return Operation.OTHER;
        }

        String statement = stripLeadingBlockComments(sql);
        int keywordEnd = 0;
        while (keywordEnd < statement.length()
                && Character.isLetter(statement.charAt(keywordEnd))) {
            keywordEnd++;
        }
        if (keywordEnd == 0) {
            return Operation.OTHER;
        }

        String keyword = statement.substring(0, keywordEnd).toUpperCase(Locale.ROOT);
        return switch (keyword) {
            case "SELECT" -> Operation.SELECT;
            case "INSERT" -> Operation.INSERT;
            case "UPDATE" -> Operation.UPDATE;
            case "DELETE" -> Operation.DELETE;
            default -> Operation.OTHER;
        };
    }

    private String stripLeadingBlockComments(String sql) {
        String remaining = sql.stripLeading();
        while (remaining.startsWith("/*")) {
            int commentEnd = remaining.indexOf("*/", 2);
            if (commentEnd < 0) {
                return "";
            }
            remaining = remaining.substring(commentEnd + 2).stripLeading();
        }
        return remaining;
    }

    private enum Operation {
        SELECT("select"),
        INSERT("insert"),
        UPDATE("update"),
        DELETE("delete"),
        OTHER("other");

        private final String tag;

        Operation(String tag) {
            this.tag = tag;
        }
    }
}
