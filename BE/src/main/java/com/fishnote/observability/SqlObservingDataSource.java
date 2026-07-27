package com.fishnote.observability;

import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import java.lang.reflect.Proxy;
import java.sql.CallableStatement;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.SQLException;
import java.sql.Statement;
import javax.sql.DataSource;
import org.springframework.jdbc.datasource.DelegatingDataSource;

/** Counts actual JDBC statement executions once, regardless of ORM/JdbcTemplate origin. */
final class SqlObservingDataSource extends DelegatingDataSource implements AutoCloseable {

    private final SqlExecutionCounter executionCounter;

    SqlObservingDataSource(DataSource targetDataSource) {
        this(targetDataSource, new SqlExecutionCounter());
    }

    SqlObservingDataSource(DataSource targetDataSource, SqlExecutionCounter executionCounter) {
        super(targetDataSource);
        this.executionCounter = executionCounter;
    }

    @Override
    public Connection getConnection() throws SQLException {
        return observe(super.getConnection());
    }

    @Override
    public Connection getConnection(String username, String password) throws SQLException {
        return observe(super.getConnection(username, password));
    }

    @Override
    public void close() throws Exception {
        DataSource target = getTargetDataSource();
        if (target instanceof AutoCloseable closeable) {
            closeable.close();
        }
    }

    private Connection observe(Connection target) {
        return (Connection) Proxy.newProxyInstance(
                Connection.class.getClassLoader(),
                new Class<?>[] {Connection.class},
                (proxy, method, arguments) -> {
                    Object result = invoke(target, method, arguments);
                    return switch (method.getName()) {
                        case "createStatement" -> observeStatement((Statement) result, null, Statement.class);
                        case "prepareStatement" -> observeStatement(
                                (PreparedStatement) result,
                                SqlOperation.classify(sqlArgument(arguments)),
                                PreparedStatement.class);
                        case "prepareCall" -> observeStatement(
                                (CallableStatement) result,
                                SqlOperation.classify(sqlArgument(arguments)),
                                CallableStatement.class);
                        default -> result;
                    };
                });
    }

    private Object observeStatement(
            Statement target,
            SqlOperation preparedOperation,
            Class<?> statementType) {
        return Proxy.newProxyInstance(
                statementType.getClassLoader(),
                new Class<?>[] {statementType},
                (proxy, method, arguments) -> {
                    if (!isExecution(method)) {
                        return invoke(target, method, arguments);
                    }
                    SqlOperation operation = preparedOperation == null
                            ? SqlOperation.classify(sqlArgument(arguments))
                            : preparedOperation;
                    long startedAt = System.nanoTime();
                    try {
                        return invoke(target, method, arguments);
                    } finally {
                        executionCounter.record(
                                operation, Math.max(0, System.nanoTime() - startedAt));
                    }
                });
    }

    private boolean isExecution(Method method) {
        return switch (method.getName()) {
            case "execute", "executeQuery", "executeUpdate", "executeLargeUpdate",
                    "executeBatch", "executeLargeBatch" -> true;
            default -> false;
        };
    }

    private String sqlArgument(Object[] arguments) {
        return arguments != null && arguments.length > 0 && arguments[0] instanceof String sql
                ? sql
                : null;
    }

    private Object invoke(Object target, Method method, Object[] arguments) throws Throwable {
        try {
            return method.invoke(target, arguments);
        } catch (InvocationTargetException exception) {
            throw exception.getTargetException();
        }
    }
}
