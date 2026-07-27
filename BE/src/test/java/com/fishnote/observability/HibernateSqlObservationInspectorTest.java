package com.fishnote.observability;

import static org.assertj.core.api.Assertions.assertThat;

import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import java.util.HashMap;
import java.util.Map;
import org.hibernate.cfg.AvailableSettings;
import org.junit.jupiter.api.Test;

class HibernateSqlObservationInspectorTest {

    @Test
    void wiresItselfIntoHibernateAndReturnsSqlUnchanged() {
        SimpleMeterRegistry registry = new SimpleMeterRegistry();
        HibernateSqlObservationInspector inspector = new HibernateSqlObservationInspector(registry);
        Map<String, Object> properties = new HashMap<>();
        String sql = "select password_hash from users where email = 'secret@example.com'";

        inspector.customize(properties);
        String inspected = inspector.inspect(sql);

        assertThat(properties.get(AvailableSettings.STATEMENT_INSPECTOR)).isSameAs(inspector);
        assertThat(inspected).isSameAs(sql);
        assertThat(registry.get(HibernateSqlObservationInspector.STATEMENT_METRIC)
                        .tag("operation", "select")
                        .counter()
                        .count())
                .isEqualTo(1.0);
        assertThat(registry.getMeters())
                .flatExtracting(meter -> meter.getId().getTags())
                .noneMatch(tag -> tag.getValue().contains("password_hash")
                        || tag.getValue().contains("secret@example.com"));
    }

    @Test
    void operationTagsHaveAFixedCardinalityIncludingCommentedSql() {
        SimpleMeterRegistry registry = new SimpleMeterRegistry();
        HibernateSqlObservationInspector inspector = new HibernateSqlObservationInspector(registry);

        inspector.inspect("/* insert Fish */ insert into fish(name) values ('secret')");
        inspector.inspect("delete from fish where id = 1");
        inspector.inspect("merge into fish using staged_fish on fish.id = staged_fish.id");

        assertThat(registry.get(HibernateSqlObservationInspector.STATEMENT_METRIC)
                        .tag("operation", "insert")
                        .counter()
                        .count())
                .isEqualTo(1.0);
        assertThat(registry.get(HibernateSqlObservationInspector.STATEMENT_METRIC)
                        .tag("operation", "delete")
                        .counter()
                        .count())
                .isEqualTo(1.0);
        assertThat(registry.get(HibernateSqlObservationInspector.STATEMENT_METRIC)
                        .tag("operation", "other")
                        .counter()
                        .count())
                .isEqualTo(1.0);
        assertThat(registry.find(HibernateSqlObservationInspector.STATEMENT_METRIC)
                        .counters())
                .hasSize(5);
    }

    @Test
    void hibernateInspectionDoesNotDoubleCountAtTheRequestBoundary() {
        SimpleMeterRegistry registry = new SimpleMeterRegistry();
        HibernateSqlObservationInspector inspector = new HibernateSqlObservationInspector(registry);

        try (RequestSqlStatementCount.Scope first = RequestSqlStatementCount.open()) {
            inspector.inspect("select 1");
            inspector.inspect("select 2");
            assertThat(first.count()).isZero();
        }
        inspector.inspect("select outside_request");
        try (RequestSqlStatementCount.Scope second = RequestSqlStatementCount.open()) {
            assertThat(second.count()).isZero();
        }
    }
}
