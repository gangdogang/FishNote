package com.fishnote.observability;

import static org.assertj.core.api.Assertions.assertThat;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.util.Map;
import javax.sql.DataSource;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.jdbc.datasource.DelegatingDataSource;
import org.springframework.jdbc.datasource.DriverManagerDataSource;

class SqlObservingDataSourceTest {

    @Test
    void countsExecutionNotPreparationAndKeepsOnlyBoundedNonSensitiveSamples() throws Exception {
        SqlExecutionCounter executionCounter = new SqlExecutionCounter();
        DataSource dataSource = observedDataSource(
                "jdbc_observation_execution", executionCounter);

        try (RequestSqlStatementCount.Scope scope = RequestSqlStatementCount.open();
                Connection connection = dataSource.getConnection();
                PreparedStatement statement = connection.prepareStatement(
                        "select 1 /* password_hash secret@example.com */")) {
            assertThat(scope.count()).isZero();
            try (ResultSet ignored = statement.executeQuery()) {
                assertThat(scope.count()).isEqualTo(1);
            }

            for (int index = 0; index < 20; index++) {
                try (PreparedStatement repeated = connection.prepareStatement("select " + index);
                        ResultSet ignored = repeated.executeQuery()) {
                    // Execute through the real JDBC boundary; SQL text is discarded immediately.
                }
            }

            RequestSqlStatementCount.Snapshot snapshot = scope.snapshot();
            assertThat(snapshot.count()).isEqualTo(21);
            assertThat(snapshot.samples()).hasSize(8);
            assertThat(snapshot.sampleTruncated()).isTrue();
            assertThat(snapshot.operationCounts()).isEqualTo("{select=21}");
            assertThat(snapshot.toString())
                    .doesNotContain("password_hash", "secret@example.com", "select 1");
            assertThat(executionCounter.total()).isEqualTo(21);
        }
    }

    @Test
    void namedParameterJdbcTemplateAndBatchEachCountOneDatabaseExecution() {
        DataSource dataSource = observedDataSource("jdbc_observation_template");
        JdbcTemplate jdbc = new JdbcTemplate(dataSource);
        NamedParameterJdbcTemplate namedJdbc = new NamedParameterJdbcTemplate(jdbc);
        jdbc.execute("create table observed_value(id integer primary key, observed_text varchar(30))");

        try (RequestSqlStatementCount.Scope scope = RequestSqlStatementCount.open()) {
            assertThat(namedJdbc.queryForObject(
                            "select :value", Map.of("value", 7), Integer.class))
                    .isEqualTo(7);
            jdbc.batchUpdate(
                    "insert into observed_value(id, observed_text) values (?, ?)",
                    java.util.Arrays.asList(new Object[] {1, "a"}, new Object[] {2, "b"}));

            assertThat(scope.count()).isEqualTo(2);
            assertThat(scope.snapshot().operationCounts())
                    .isEqualTo("{select=1,insert=1}");
        }
    }

    @Test
    void beanPostProcessorPreservesConcreteDelegatingDataSourceBeans() {
        DelegatingDataSource custom = new DelegatingDataSource(
                new DriverManagerDataSource("jdbc:h2:mem:jdbc_observation_bpp", "sa", ""));
        SqlObservationDataSourceBeanPostProcessor processor =
                new SqlObservationDataSourceBeanPostProcessor(new SqlExecutionCounter());

        Object processed = processor.postProcessAfterInitialization(custom, "dataSource");

        assertThat(processed).isSameAs(custom);
        assertThat(custom.getTargetDataSource()).isInstanceOf(SqlObservingDataSource.class);
    }

    private DataSource observedDataSource(String databaseName) {
        return observedDataSource(databaseName, new SqlExecutionCounter());
    }

    private DataSource observedDataSource(
            String databaseName,
            SqlExecutionCounter executionCounter) {
        return new SqlObservingDataSource(new DriverManagerDataSource(
                "jdbc:h2:mem:" + databaseName + ";DB_CLOSE_DELAY=-1", "sa", ""), executionCounter);
    }
}
