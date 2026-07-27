package com.fishnote.source;

import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.everyItem;
import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.nullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.head;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fishnote.fish.Fish;
import com.fishnote.fish.FishRepository;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class FishSourceControllerTest {

    private static final String PUBLISHER = "인천광역시 수산자원연구소";
    private static final String LICENSE = "공공누리 제1유형(출처표시)";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private FishRepository fishRepository;

    @Autowired
    private FishSourceRepository fishSourceRepository;

    @Test
    void noSourceFishStillReturnsEveryClaimInFixedOrderWithUnverifiedSeason() throws Exception {
        Fish fish = fishRepository.saveAndFlush(fish("광어", "gwangeo"));

        mockMvc.perform(get("/api/v1/fish/{identifier}/sources", "gwangeo"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.fishId", is(fish.getId().intValue())))
                .andExpect(jsonPath("$.fishName", is("광어")))
                .andExpect(jsonPath("$.summary.verificationStatus", is("UNVERIFIED")))
                .andExpect(jsonPath("$.summary.lastVerifiedAt", nullValue()))
                .andExpect(jsonPath("$.summary.sourceCount", is(0)))
                .andExpect(jsonPath("$.summary.verifiedClaimCount", is(0)))
                .andExpect(jsonPath("$.summary.claimCount", is(5)))
                .andExpect(jsonPath("$.claims.length()", is(5)))
                .andExpect(jsonPath("$.claims[*].claimType", contains(
                        "IDENTITY", "SEASON", "TASTE", "PRICE", "PHOTO")))
                .andExpect(jsonPath("$.claims[*].verificationStatus", everyItem(is("UNVERIFIED"))))
                .andExpect(jsonPath("$.claims[*].sourceCount", everyItem(is(0))))
                .andExpect(jsonPath("$.claims[1].claimType", is("SEASON")))
                .andExpect(jsonPath("$.claims[1].sources.length()", is(0)));
    }

    @Test
    void numericAndSlugLookupsExposeDeterministicClaimAndSourceAggregation() throws Exception {
        Fish fish = fishRepository.saveAndFlush(fish("우럭", "ureok"));
        OffsetDateTime highVerifiedAt = OffsetDateTime.parse("2026-07-15T00:00:00Z");
        OffsetDateTime latestVerifiedAt = OffsetDateTime.parse("2026-07-16T00:00:00Z");

        fishSourceRepository.saveAllAndFlush(List.of(
                source(
                        fish,
                        FishClaimType.SEASON,
                        SourceConfidence.HIGH,
                        "HIGH 제철 근거",
                        "https://example.test/season/high",
                        LocalDate.of(2026, 5, 11),
                        highVerifiedAt),
                source(
                        fish,
                        FishClaimType.SEASON,
                        SourceConfidence.MEDIUM,
                        "MEDIUM 제철 근거",
                        "https://example.test/season/medium",
                        LocalDate.of(2026, 5, 12),
                        latestVerifiedAt),
                source(
                        fish,
                        FishClaimType.TASTE,
                        SourceConfidence.MEDIUM,
                        "맛 근거",
                        "https://example.test/taste",
                        null,
                        highVerifiedAt),
                source(
                        fish,
                        FishClaimType.PRICE,
                        SourceConfidence.LOW,
                        "가격 근거",
                        "https://example.test/price",
                        null,
                        null)));

        mockMvc.perform(get("/api/v1/fish/{identifier}/sources", fish.getId()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.fishId", is(fish.getId().intValue())))
                .andExpect(jsonPath("$.fishName", is("우럭")))
                .andExpect(jsonPath("$.summary.verificationStatus", is("PARTIALLY_VERIFIED")))
                .andExpect(jsonPath("$.summary.lastVerifiedAt", is("2026-07-16T00:00:00Z")))
                .andExpect(jsonPath("$.summary.sourceCount", is(4)))
                .andExpect(jsonPath("$.summary.verifiedClaimCount", is(1)))
                .andExpect(jsonPath("$.summary.claimCount", is(5)))
                .andExpect(jsonPath("$.claims[*].claimType", contains(
                        "IDENTITY", "SEASON", "TASTE", "PRICE", "PHOTO")))
                .andExpect(jsonPath("$.claims[0].verificationStatus", is("UNVERIFIED")))
                .andExpect(jsonPath("$.claims[1].verificationStatus", is("VERIFIED")))
                .andExpect(jsonPath("$.claims[1].lastVerifiedAt", is("2026-07-16T00:00:00Z")))
                .andExpect(jsonPath("$.claims[1].sourceCount", is(2)))
                .andExpect(jsonPath("$.claims[1].sources[0].title", is("MEDIUM 제철 근거")))
                .andExpect(jsonPath("$.claims[1].sources[0].claimType", is("SEASON")))
                .andExpect(jsonPath("$.claims[1].sources[0].publisher", is(PUBLISHER)))
                .andExpect(jsonPath("$.claims[1].sources[0].publishedAt", is("2026-05-12")))
                .andExpect(jsonPath("$.claims[1].sources[0].license", is(LICENSE)))
                .andExpect(jsonPath("$.claims[1].sources[0].confidence", is("MEDIUM")))
                .andExpect(jsonPath("$.claims[1].sources[1].title", is("HIGH 제철 근거")))
                .andExpect(jsonPath("$.claims[2].verificationStatus", is("PARTIALLY_VERIFIED")))
                .andExpect(jsonPath("$.claims[3].verificationStatus", is("PARTIALLY_VERIFIED")))
                .andExpect(jsonPath("$.claims[4].verificationStatus", is("UNVERIFIED")));

        mockMvc.perform(get("/api/v1/fish/{identifier}/sources", "ureok"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.fishId", is(fish.getId().intValue())))
                .andExpect(jsonPath("$.fishName", is("우럭")))
                .andExpect(jsonPath("$.summary.sourceCount", is(4)));
    }

    @Test
    void unknownNumericAndSlugIdentifiersReturnTheStandard404() throws Exception {
        mockMvc.perform(get("/api/v1/fish/{identifier}/sources", "missing-fish"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.status", is(404)))
                .andExpect(jsonPath("$.message", is("횟감을 찾을 수 없습니다.")));

        mockMvc.perform(get(
                        "/api/v1/fish/{identifier}/sources",
                        "999999999999999999999999999999999999"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.status", is(404)));
    }

    @Test
    void anonymousHeadIsPublicWithoutChangingTheGetContract() throws Exception {
        Fish fish = fishRepository.saveAndFlush(fish("방어", "bangeo"));

        mockMvc.perform(head("/api/v1/fish/{identifier}/sources", fish.getId()))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/v1/fish/{identifier}/sources", fish.getId()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.summary.verificationStatus", is("UNVERIFIED")));
    }

    private Fish fish(String name, String slug) {
        Fish fish = new Fish();
        fish.setName(name);
        fish.setSlug(slug);
        fish.setCategory(com.fishnote.fish.FishCategory.FISH);
        fish.setFeatured(false);
        return fish;
    }

    private FishSource source(
            Fish fish,
            FishClaimType claimType,
            SourceConfidence confidence,
            String title,
            String url,
            LocalDate publishedAt,
            OffsetDateTime verifiedAt) {
        return new FishSource(
                fish,
                claimType,
                PUBLISHER,
                title,
                url,
                publishedAt,
                verifiedAt,
                LICENSE,
                confidence);
    }
}
