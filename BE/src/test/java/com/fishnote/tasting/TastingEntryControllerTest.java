package com.fishnote.tasting;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.is;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fishnote.fish.Fish;
import com.fishnote.fish.FishRepository;
import com.fishnote.image.ImageAssetPersistenceService;
import com.fishnote.image.ImageUploaderKeyFactory;
import com.fishnote.image.ReviewImageAssetRepository;
import com.fishnote.image.ReviewImageAssetStatus;
import com.fishnote.user.UserRepository;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Map;
import java.util.UUID;
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
class TastingEntryControllerTest {

    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper objectMapper;
    @Autowired private FishRepository fishRepository;
    @Autowired private UserRepository userRepository;
    @Autowired private TastingEntryRepository tastingRepository;
    @Autowired private ReviewImageAssetRepository imageAssetRepository;
    @Autowired private ImageAssetPersistenceService imageAssetPersistenceService;
    @Autowired private ImageUploaderKeyFactory imageUploaderKeyFactory;

    private Fish fish;

    @BeforeEach
    void setUp() {
        imageAssetRepository.deleteAll();
        tastingRepository.deleteAll();
        userRepository.deleteAll();
        fishRepository.deleteAll();
        fish = new Fish();
        fish.setName("광어");
        fish.setSlug("gwang-eo");
        fish.setImageUrl("/fish/gwangeo.jpg");
        fish = fishRepository.save(fish);
    }

    @AfterEach
    void tearDown() {
        imageAssetRepository.deleteAll();
        tastingRepository.deleteAll();
        userRepository.deleteAll();
        fishRepository.deleteAll();
    }

    @Test
    void memberCanCreateListUpdateAndDeletePrivateTastingWithPhoto() throws Exception {
        String ownerToken = signupAndLogin("tasting-owner@example.com", "기록가");
        Long ownerId = userRepository.findByEmail("tasting-owner@example.com").orElseThrow().getId();
        PendingImage image = pendingImage(imageUploaderKeyFactory.forUser(ownerId));
        String tastedOn = LocalDate.now().minusDays(1).toString();

        String createdBody = mockMvc.perform(post("/api/v1/me/tastings")
                        .header("Authorization", bearer(ownerToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of(
                                "fishId", fish.getId(),
                                "tastedOn", tastedOn,
                                "rating", 5,
                                "preparation", "AGED",
                                "placeName", "노량진 테스트수산",
                                "note", "단맛이 또렷했어요",
                                "imageUrl", image.url(),
                                "imageAssetId", image.id()))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.fishName", is("광어")))
                .andExpect(jsonPath("$.rating", is(5)))
                .andExpect(jsonPath("$.preparation", is("AGED")))
                .andExpect(jsonPath("$.imageUrl", is(image.url())))
                .andReturn().getResponse().getContentAsString();
        long entryId = objectMapper.readTree(createdBody).get("id").asLong();

        var attached = imageAssetRepository.findById(image.id()).orElseThrow();
        assertThat(attached.getStatus()).isEqualTo(ReviewImageAssetStatus.ATTACHED);
        assertThat(attached.getTastingEntry().getId()).isEqualTo(entryId);

        mockMvc.perform(get("/api/v1/me/tastings")
                        .header("Authorization", bearer(ownerToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items.length()", is(1)))
                .andExpect(jsonPath("$.items[0].id", is((int) entryId)))
                .andExpect(jsonPath("$.stats.totalEntries", is(1)))
                .andExpect(jsonPath("$.stats.distinctFishCount", is(1)));

        mockMvc.perform(put("/api/v1/me/tastings/{id}", entryId)
                        .header("Authorization", bearer(ownerToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of(
                                "fishId", fish.getId(),
                                "tastedOn", tastedOn,
                                "rating", 4,
                                "preparation", "RAW",
                                "placeName", "집",
                                "note", "간장과 잘 맞았어요"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.rating", is(4)))
                .andExpect(jsonPath("$.imageUrl", is(image.url())));

        String otherToken = signupAndLogin("tasting-other@example.com", "다른회원");
        mockMvc.perform(delete("/api/v1/me/tastings/{id}", entryId)
                        .header("Authorization", bearer(otherToken)))
                .andExpect(status().isNotFound());

        mockMvc.perform(delete("/api/v1/me/tastings/{id}", entryId)
                        .header("Authorization", bearer(ownerToken)))
                .andExpect(status().isNoContent());
        assertThat(tastingRepository.findById(entryId)).isEmpty();
        var queued = imageAssetRepository.findById(image.id()).orElseThrow();
        assertThat(queued.getStatus()).isEqualTo(ReviewImageAssetStatus.DELETE_PENDING);
        assertThat(queued.getTastingEntry()).isNull();
    }

    @Test
    void endpointsRequireAuthenticationAndRejectFutureDate() throws Exception {
        mockMvc.perform(get("/api/v1/me/tastings"))
                .andExpect(status().isUnauthorized());

        String token = signupAndLogin("tasting-validation@example.com", "검증회원");
        mockMvc.perform(post("/api/v1/me/tastings")
                        .header("Authorization", bearer(token))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of(
                                "fishId", fish.getId(),
                                "tastedOn", LocalDate.now().plusDays(1).toString(),
                                "preparation", "RAW"))))
                .andExpect(status().isBadRequest());
    }

    private String signupAndLogin(String email, String nickname) throws Exception {
        mockMvc.perform(post("/api/v1/auth/signup")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of(
                                "email", email,
                                "password", "password123",
                                "nickname", nickname))))
                .andExpect(status().isCreated());
        String body = mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("email", email, "password", "password123"))))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        return objectMapper.readTree(body).get("accessToken").asText();
    }

    private PendingImage pendingImage(String uploaderKey) {
        UUID id = UUID.randomUUID();
        String publicId = "fishnote/reviews/" + id;
        String url = "https://res.cloudinary.com/test-cloud/image/upload/" + publicId + ".jpg";
        OffsetDateTime expiresAt = OffsetDateTime.now(ZoneOffset.UTC).plusHours(1);
        imageAssetPersistenceService.reserve(id, publicId, uploaderKey, expiresAt);
        imageAssetPersistenceService.completeUpload(
                id,
                publicId,
                url,
                expiresAt.minusHours(1),
                expiresAt);
        return new PendingImage(id, url);
    }

    private String bearer(String token) {
        return "Bearer " + token;
    }

    private String json(Object value) throws Exception {
        return objectMapper.writeValueAsString(value);
    }

    private record PendingImage(UUID id, String url) {
    }
}
