package com.fishnote.price;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.test.context.ActiveProfiles;

@DataJpaTest
@ActiveProfiles("test")
class ShopPriceObservationRepositoryTest {

    @Autowired
    private ShopPriceObservationRepository repository;

    @Test
    void entityDualWritesSha256HashForLongRawText() {
        ShopPriceObservation observation = observation(null, "🐟".repeat(8_000));

        repository.saveAndFlush(observation);

        assertThat(observation.getDedupHash())
                .hasSize(64)
                .matches("[0-9a-f]{64}")
                .isEqualTo(DedupKeyFactory.create(observation));
        assertThat(observation.getRawText()).hasSize(16_000);
    }

    @Test
    void uniqueHashBlocksDuplicateWhenSourceNameIsNull() {
        repository.saveAndFlush(observation(null, "점 성 어1kgㅡ25000"));

        assertThatThrownBy(() -> repository.saveAndFlush(observation(null, "점 성 어1kgㅡ25000")))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    private ShopPriceObservation observation(String sourceName, String rawText) {
        ShopPriceObservation observation = new ShopPriceObservation();
        observation.setObservedAt(OffsetDateTime.parse("2026-07-22T08:00:00+09:00"));
        observation.setSourceType("telegram_bot");
        observation.setSourceName(sourceName);
        observation.setCanonicalFishName("점성어");
        observation.setReportedName("점 성 어");
        observation.setPriceMinKrw(25_000);
        observation.setPriceMaxKrw(25_000);
        observation.setConfidence(new BigDecimal("0.90"));
        observation.setRawText(rawText);
        return observation;
    }
}
