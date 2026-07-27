package com.fishnote.correction;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.is;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.fishnote.fish.Fish;
import com.fishnote.fish.FishRepository;
import com.fishnote.source.FishClaimType;
import java.util.Arrays;
import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class FishCorrectionControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private FishRepository fishRepository;

    @Autowired
    private FishCorrectionRequestRepository correctionRepository;

    private Fish fish;

    @BeforeEach
    void setUp() {
        correctionRepository.deleteAll();
        fishRepository.deleteAll();
        Fish saved = new Fish();
        saved.setName("광어");
        saved.setSlug("gwangeo-correction-test");
        fish = fishRepository.save(saved);
    }

    @AfterEach
    void tearDown() {
        correctionRepository.deleteAll();
        fishRepository.deleteAll();
    }

    @Test
    void anonymousSubmissionReturnsOnlyAcceptedReceiptAndPersistsTrimmedContent() throws Exception {
        String unreachableEvidenceUrl = "https://127.0.0.1:1/evidence";

        String response = mockMvc.perform(post("/api/v1/fish/{id}/corrections", fish.getId())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(request("SEASON", "  제철 정보를 확인해 주세요.  ", unreachableEvidenceUrl)))
                .andExpect(status().isAccepted())
                .andExpect(jsonPath("$.id").isNumber())
                .andExpect(jsonPath("$.status", is("PENDING")))
                .andReturn()
                .getResponse()
                .getContentAsString();

        JsonNode receipt = objectMapper.readTree(response);
        assertThat(receipt.size()).isEqualTo(2);
        assertThat(receipt.path("id").asLong()).isPositive();
        FishCorrectionRequest saved = correctionRepository.findById(receipt.path("id").asLong()).orElseThrow();
        assertThat(saved.getFish().getId()).isEqualTo(fish.getId());
        assertThat(saved.getClaimType()).isEqualTo(FishClaimType.SEASON);
        assertThat(saved.getMessage()).isEqualTo("제철 정보를 확인해 주세요.");
        assertThat(saved.getSourceUrl()).isEqualTo(unreachableEvidenceUrl);
        assertThat(saved.getStatus()).isEqualTo(CorrectionRequestStatus.PENDING);
        assertThat(saved.getCreatedAt()).isNotNull();
        assertThat(saved.getResolvedAt()).isNull();
    }

    @Test
    void acceptsEverySupportedClaimType() throws Exception {
        assertThat(Set.copyOf(Arrays.asList(FishClaimType.values())))
                .containsExactlyInAnyOrder(
                        FishClaimType.IDENTITY,
                        FishClaimType.SEASON,
                        FishClaimType.TASTE,
                        FishClaimType.PRICE,
                        FishClaimType.PHOTO);

        for (FishClaimType claimType : FishClaimType.values()) {
            mockMvc.perform(post("/api/v1/fish/{id}/corrections", fish.getId())
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(request(claimType.name(), claimType.name() + " 제보", null)))
                    .andExpect(status().isAccepted())
                    .andExpect(jsonPath("$.status", is("PENDING")));
        }

        assertThat(correctionRepository.findAll())
                .extracting(FishCorrectionRequest::getClaimType)
                .containsExactlyInAnyOrder(FishClaimType.values());
    }

    @Test
    void rejectsMissingOrUnknownClaimTypes() throws Exception {
        for (String body : List.of(
                "{\"message\":\"제보\"}",
                "{\"claimType\":null,\"message\":\"제보\"}",
                "{\"claimType\":\"UNKNOWN\",\"message\":\"제보\"}")) {
            mockMvc.perform(post("/api/v1/fish/{id}/corrections", fish.getId())
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(body))
                    .andExpect(status().isBadRequest());
        }
        assertThat(correctionRepository.count()).isZero();
    }

    @Test
    void rejectsBlankAndOverlongMessagesAfterTrimming() throws Exception {
        for (String invalidMessage : List.of("", "   ", "\n\t", "a".repeat(1001))) {
            mockMvc.perform(post("/api/v1/fish/{id}/corrections", fish.getId())
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(request("IDENTITY", invalidMessage, null)))
                    .andExpect(status().isBadRequest());
        }
        assertThat(correctionRepository.count()).isZero();
    }

    @Test
    void rejectsOversizedJsonBeforeDeserializationOrPersistence() throws Exception {
        mockMvc.perform(post("/api/v1/fish/{id}/corrections", fish.getId())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"claimType\":\"SEASON\",\"message\":\""
                                + "a".repeat(20_000)
                                + "\"}"))
                .andExpect(status().isPayloadTooLarge())
                .andExpect(jsonPath("$.code", is("PAYLOAD_TOO_LARGE")))
                .andExpect(jsonPath("$.fieldErrors").isMap());

        assertThat(correctionRepository.count()).isZero();
    }

    @Test
    void acceptsTheExactMessageAndSourceUrlLimits() throws Exception {
        String sourceUrl = "https://example.com/" + "a".repeat(2028);
        assertThat(sourceUrl).hasSize(2048);

        mockMvc.perform(post("/api/v1/fish/{id}/corrections", fish.getId())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(request("PRICE", "a".repeat(1000), sourceUrl)))
                .andExpect(status().isAccepted());

        FishCorrectionRequest saved = correctionRepository.findAll().get(0);
        assertThat(saved.getMessage()).hasSize(1000);
        assertThat(saved.getSourceUrl()).hasSize(2048);
    }

    @Test
    void rejectsUnsafeOrNonHttpSourceUrls() throws Exception {
        List<String> invalidUrls = List.of(
                "relative/evidence",
                "ftp://example.com/evidence",
                "javascript:alert(1)",
                "data:text/plain,evidence",
                "file:///tmp/evidence",
                "https://user:secret@example.com/evidence",
                "https:///missing-host",
                "https://example.com/\nnext",
                "https://example.com/%0Anext",
                "https://example.com/" + "a".repeat(2029));

        for (String sourceUrl : invalidUrls) {
            mockMvc.perform(post("/api/v1/fish/{id}/corrections", fish.getId())
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(request("PHOTO", "출처 URL 검증", sourceUrl)))
                    .andExpect(status().isBadRequest());
        }
        assertThat(correctionRepository.count()).isZero();
    }

    @Test
    void omittedAndSpaceOnlySourceUrlsAreStoredAsNull() throws Exception {
        mockMvc.perform(post("/api/v1/fish/{id}/corrections", fish.getId())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(request("TASTE", "URL 생략", null)))
                .andExpect(status().isAccepted());
        mockMvc.perform(post("/api/v1/fish/{id}/corrections", fish.getId())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(request("TASTE", "URL 공백", "   ")))
                .andExpect(status().isAccepted());

        assertThat(correctionRepository.findAll())
                .extracting(FishCorrectionRequest::getSourceUrl)
                .containsOnlyNulls();
    }

    @Test
    void missingFishReturns404AndInvalidIdentifiersReturn400() throws Exception {
        mockMvc.perform(post("/api/v1/fish/{id}/corrections", Long.MAX_VALUE)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(request("SEASON", "없는 생선", null)))
                .andExpect(status().isNotFound());

        for (String invalidId : List.of("0", "-1", "not-a-number")) {
            mockMvc.perform(post("/api/v1/fish/{id}/corrections", invalidId)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(request("SEASON", "잘못된 ID", null)))
                    .andExpect(status().isBadRequest());
        }
        assertThat(correctionRepository.count()).isZero();
    }

    @Test
    void correctionPermitDoesNotOpenNestedOrNeighboringWrites() throws Exception {
        mockMvc.perform(post("/api/v1/fish/{id}/corrections/admin", fish.getId())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isUnauthorized());
        mockMvc.perform(post("/api/v1/fish/{id}", fish.getId())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void correctionEntityHasNoIdentityOrNetworkActorFields() {
        assertThat(Arrays.stream(FishCorrectionRequest.class.getDeclaredFields())
                        .map(field -> field.getName().toLowerCase())
                        .toList())
                .doesNotContain("name", "email", "ip", "ipaddress", "userid", "user");
    }

    private String request(String claimType, String message, String sourceUrl) throws Exception {
        ObjectNode request = objectMapper.createObjectNode();
        request.put("claimType", claimType);
        request.put("message", message);
        if (sourceUrl != null) {
            request.put("sourceUrl", sourceUrl);
        }
        return objectMapper.writeValueAsString(request);
    }
}
