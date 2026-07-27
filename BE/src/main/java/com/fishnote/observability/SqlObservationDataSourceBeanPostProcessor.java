package com.fishnote.observability;

import javax.sql.DataSource;
import org.springframework.beans.BeansException;
import org.springframework.beans.factory.config.BeanPostProcessor;
import org.springframework.core.Ordered;
import org.springframework.jdbc.datasource.DelegatingDataSource;
import org.springframework.stereotype.Component;

/** Installs one JDBC execution observer while preserving concrete DelegatingDataSource test beans. */
@Component
public final class SqlObservationDataSourceBeanPostProcessor
        implements BeanPostProcessor, Ordered {

    private final SqlExecutionCounter executionCounter;

    public SqlObservationDataSourceBeanPostProcessor(SqlExecutionCounter executionCounter) {
        this.executionCounter = executionCounter;
    }

    @Override
    public Object postProcessAfterInitialization(Object bean, String beanName) throws BeansException {
        if (!(bean instanceof DataSource dataSource) || bean instanceof SqlObservingDataSource) {
            return bean;
        }
        if (dataSource instanceof DelegatingDataSource delegatingDataSource) {
            DataSource target = delegatingDataSource.getTargetDataSource();
            if (target != null && !(target instanceof SqlObservingDataSource)) {
                delegatingDataSource.setTargetDataSource(
                        new SqlObservingDataSource(target, executionCounter));
            }
            return bean;
        }
        return new SqlObservingDataSource(dataSource, executionCounter);
    }

    @Override
    public int getOrder() {
        return Ordered.LOWEST_PRECEDENCE;
    }
}
