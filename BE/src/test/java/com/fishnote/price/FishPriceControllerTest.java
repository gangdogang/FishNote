package com.fishnote.price;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsInAnyOrder;
import static org.hamcrest.Matchers.is;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fishnote.fish.Fish;
import com.fishnote.fish.FishRepository;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class FishPriceControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private FishRepository fishRepository;

    @Autowired
    private ShopPriceObservationRepository observationRepository;

    private Fish fish;

    @BeforeEach
    void setUp() {
        observationRepository.deleteAll();
        fishRepository.deleteAll();

        fish = new Fish();
        fish.setName("광어");
        fish.setNameEn("Olive flounder");
        fish.setDescription("광어 설명");
        fish.setPriceLevel((short) 2);
        fish = fishRepository.save(fish);
    }

    @Test
    void returnsRecentPricesWithoutInternalCollectionFields() throws Exception {
        observationRepository.save(observation(
                OffsetDateTime.now(ShopPriceParser.KST).minusHours(2), "윤호수산", 31000, 33000));
        observationRepository.save(observation(
                OffsetDateTime.now(ShopPriceParser.KST).minusHours(1), "성전물산", 32000, 34000));
        observationRepository.save(observation(
                OffsetDateTime.now(ShopPriceParser.KST).minusDays(20), "윤호수산", 25000, 25000));

        String response = mockMvc.perform(get("/api/v1/fish/{fishId}/prices", fish.getId()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.fishId", is(fish.getId().intValue())))
                .andExpect(jsonPath("$.days", is(14)))
                .andExpect(jsonPath("$.observationCount", is(2)))
                .andExpect(jsonPath("$.latest.priceMinKrw", is(32000)))
                .andExpect(jsonPath("$.latest.priceMaxKrw", is(34000)))
                .andExpect(jsonPath("$.latest.origin", is("제주")))
                .andExpect(jsonPath("$.latest.sizeGrade", is("2.4~2.5kg")))
                .andExpect(jsonPath("$.latest.unit", is("kg")))
                .andExpect(jsonPath("$.latest.sourceLabel", is("상회 시세")))
                .andExpect(jsonPath("$.latest.shopName", is("성전물산")))
                .andExpect(jsonPath("$.recent.length()", is(2)))
                .andExpect(jsonPath("$.dailyAverage.length()", is(1)))
                .andExpect(jsonPath("$.dailyAverage[0].priceMinKrw", is(31000)))
                .andExpect(jsonPath("$.dailyAverage[0].priceMaxKrw", is(34000)))
                .andExpect(jsonPath("$.dailyAverage[0].avgPriceKrw", is(32500)))
                .andExpect(jsonPath("$.dailyAverage[0].observationCount", is(2)))
                .andExpect(jsonPath("$.byShop[*].shopName", containsInAnyOrder("윤호수산", "성전물산")))
                .andExpect(jsonPath("$.byShop.length()", is(2)))
                .andReturn()
                .getResponse()
                .getContentAsString();

        assertThat(response)
                .doesNotContain("내부업체명", "내부발화자", "민감한 원문")
                .doesNotContain("sourceName", "sourceType", "speaker", "rawText", "reportedName");
    }

    @Test
    void clampsRequestedDaysAndReturnsEmptySummary() throws Exception {
        mockMvc.perform(get("/api/v1/fish/{fishId}/prices", fish.getId()).param("days", "999"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.days", is(30)))
                .andExpect(jsonPath("$.observationCount", is(0)))
                .andExpect(jsonPath("$.latest").doesNotExist())
                .andExpect(jsonPath("$.recent.length()", is(0)));
    }

    @Test
    void returnsNotFoundForMissingFish() throws Exception {
        mockMvc.perform(get("/api/v1/fish/{fishId}/prices", Long.MAX_VALUE))
                .andExpect(status().isNotFound());
    }

    private ShopPriceObservation observation(OffsetDateTime observedAt, String shopName, int minPrice, int maxPrice) {
        ShopPriceObservation observation = new ShopPriceObservation();
        observation.setFish(fish);
        observation.setObservedAt(observedAt);
        observation.setSourceType("telegram_bot");
        observation.setSourceName(shopName);
        observation.setSpeaker("내부발화자");
        observation.setCanonicalFishName("광어");
        observation.setReportedName("제주광어");
        observation.setOrigin("제주");
        observation.setSizeGrade("2.4~2.5kg");
        observation.setUnit("kg");
        observation.setPriceMinKrw(minPrice);
        observation.setPriceMaxKrw(maxPrice);
        observation.setConfidence(BigDecimal.valueOf(0.9));
        observation.setRawText("민감한 원문");
        return observation;
    }
}
