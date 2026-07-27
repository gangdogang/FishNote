package com.fishnote.query;

import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Proxy;
import java.sql.Connection;
import java.util.Locale;
import java.util.concurrent.atomic.AtomicInteger;
import javax.sql.DataSource;
import org.springframework.jdbc.datasource.DelegatingDataSource;

final class SqlStatementCounter extends DelegatingDataSource {

    private final AtomicInteger selectCount = new AtomicInteger();

    SqlStatementCounter(DataSource targetDataSource) {
        super(targetDataSource);
    }

    @Override
    public Connection getConnection() throws java.sql.SQLException {
        return wrap(super.getConnection());
    }

    @Override
    public Connection getConnection(String username, String password) throws java.sql.SQLException {
        return wrap(super.getConnection(username, password));
    }

    void clear() {
        selectCount.set(0);
    }

    int selectCount() {
        return selectCount.get();
    }

    private Connection wrap(Connection target) {
        return (Connection) Proxy.newProxyInstance(
                Connection.class.getClassLoader(),
                new Class<?>[] {Connection.class},
                (proxy, method, args) -> {
                    if (("prepareStatement".equals(method.getName())
                            || "prepareCall".equals(method.getName()))
                            && args != null
                            && args.length > 0
                            && args[0] instanceof String sql
                            && isSelect(sql)) {
                        selectCount.incrementAndGet();
                    }
                    try {
                        return method.invoke(target, args);
                    } catch (InvocationTargetException ex) {
                        throw ex.getTargetException();
                    }
                });
    }

    private boolean isSelect(String sql) {
        String normalized = sql.stripLeading().toUpperCase(Locale.ROOT);
        return normalized.startsWith("SELECT") || normalized.startsWith("WITH");
    }
}
