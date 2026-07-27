package com.fishnote.query;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fishnote.cache.CacheNames;
import com.fishnote.cache.FishListCacheQuery;
import com.fishnote.cache.FishPriceCacheQuery;
import com.fishnote.cache.PublicReadCacheService;
import com.fishnote.fish.Fish;
import com.fishnote.fish.FishCategory;
import com.fishnote.fish.FishRepository;
import com.fishnote.price.PriceResolution;
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Proxy;
import java.sql.Connection;
import java.sql.SQLException;
import java.util.Locale;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;
import javax.sql.DataSource;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.jdbc.DataSourceProperties;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.cache.CacheManager;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import org.springframework.jdbc.datasource.DelegatingDataSource;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest
@ActiveProfiles("test")
@AutoConfigureMockMvc
class PublicCacheAndReadinessContractTest {

    @TestConfiguration(proxyBeanMethods = false)
    static class ToggleDataSourceConfiguration {

        @Bean
        @Primary
        ToggleCountingDataSource dataSource(DataSourceProperties properties) {
            DriverManagerDataSource target = new DriverManagerDataSource();
            target.setDriverClassName(properties.determineDriverClassName());
            target.setUrl(properties.determineUrl()
                    .replaceFirst("mem:[^;]+", "mem:fishnote_t1_cache_readiness")
                    + ";DB_CLOSE_DELAY=-1");
            target.setUsername(properties.determineUsername());
            target.setPassword(properties.determinePassword());
            return new ToggleCountingDataSource(target);
        }
    }

    private final FishRepository fishRepository;
    private final PublicReadCacheService publicReads;
    private final CacheManager cacheManager;
    private final ToggleCountingDataSource dataSource;
    private final MockMvc mockMvc;

    private Long fishId;

    @Autowired
    PublicCacheAndReadinessContractTest(
            FishRepository fishRepository,
            PublicReadCacheService publicReads,
            CacheManager cacheManager,
            ToggleCountingDataSource dataSource,
            MockMvc mockMvc) {
        this.fishRepository = fishRepository;
        this.publicReads = publicReads;
        this.cacheManager = cacheManager;
        this.dataSource = dataSource;
        this.mockMvc = mockMvc;
    }

    @BeforeEach
    void setUp() {
        dataSource.setUnavailable(false);
        cacheManager.getCacheNames().forEach(name -> cacheManager.getCache(name).clear());
        fishRepository.deleteAll();

        Fish fish = new Fish();
        fish.setName("캐시계약어종");
        fish.setSlug("cache-contract-fish");
        fish.setCategory(FishCategory.FISH);
        fish.setDescription("공개 read cache 계약 fixture");
        fish.setPriceLevel((short) 2);
        fish.setFeatured(true);
        fish.getSeasonMonths().add((short) 7);
        fish.getTasteTags().add("담백");
        fishId = fishRepository.saveAndFlush(fish).getId();
        dataSource.clearSelectCount();
    }

    @Test
    void repeatedCatalogAndPriceReadsHitCaffeineWithoutAnotherDatabaseSelect() {
        FishListCacheQuery catalogQuery = new FishListCacheQuery(
                null, null, null, null, null, null, "popular");

        assertThat(publicReads.listV1(catalogQuery)).hasSize(1);
        assertThat(dataSource.selectCount()).isPositive();

        dataSource.clearSelectCount();
        assertThat(publicReads.listV1(catalogQuery)).hasSize(1);
        assertThat(dataSource.selectCount())
                .as("a catalog cache hit must not touch the database")
                .isZero();

        FishPriceCacheQuery priceQuery = new FishPriceCacheQuery(
                fishId, 14, PriceResolution.DAY, 30, null);
        dataSource.clearSelectCount();
        assertThat(publicReads.price(priceQuery).fishId()).isEqualTo(fishId);
        assertThat(dataSource.selectCount()).isPositive();

        dataSource.clearSelectCount();
        assertThat(publicReads.price(priceQuery).fishId()).isEqualTo(fishId);
        assertThat(dataSource.selectCount())
                .as("a price cache hit must not touch the database")
                .isZero();

        assertThat(cacheManager.getCache(CacheNames.FISH_CATALOG)).isNotNull();
        assertThat(cacheManager.getCache(CacheNames.FISH_PRICE)).isNotNull();
    }

    @Test
    void readinessTurnsDownWithTheDatabaseWhileLivenessStaysUp() throws Exception {
        mockMvc.perform(get("/actuator/health/readiness"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("UP"));

        dataSource.setUnavailable(true);
        try {
            mockMvc.perform(get("/actuator/health/readiness"))
                    .andExpect(status().isServiceUnavailable())
                    .andExpect(jsonPath("$.status").value("DOWN"));
            mockMvc.perform(get("/actuator/health/liveness"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.status").value("UP"));
        } finally {
            dataSource.setUnavailable(false);
        }

        mockMvc.perform(get("/actuator/health/readiness"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("UP"));
    }

    static final class ToggleCountingDataSource extends DelegatingDataSource {

        private final AtomicBoolean unavailable = new AtomicBoolean();
        private final AtomicInteger selectCount = new AtomicInteger();

        ToggleCountingDataSource(DataSource targetDataSource) {
            super(targetDataSource);
        }

        @Override
        public Connection getConnection() throws SQLException {
            if (unavailable.get()) {
                throw new SQLException("simulated database outage");
            }
            return wrap(super.getConnection());
        }

        @Override
        public Connection getConnection(String username, String password) throws SQLException {
            if (unavailable.get()) {
                throw new SQLException("simulated database outage");
            }
            return wrap(super.getConnection(username, password));
        }

        void setUnavailable(boolean value) {
            unavailable.set(value);
        }

        void clearSelectCount() {
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
                        } catch (InvocationTargetException exception) {
                            throw exception.getTargetException();
                        }
                    });
        }

        private boolean isSelect(String sql) {
            String normalized = sql.stripLeading().toUpperCase(Locale.ROOT);
            return normalized.startsWith("SELECT") || normalized.startsWith("WITH");
        }
    }
}
