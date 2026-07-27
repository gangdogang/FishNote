package com.fishnote.review;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.hamcrest.Matchers.is;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.Mockito.doThrow;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
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
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.SpyBean;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class ReviewControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private FishRepository fishRepository;

    @SpyBean
    private ReviewRepository reviewRepository;

    @Autowired
    private ReviewService reviewService;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private ReviewImageAssetRepository imageAssetRepository;

    @Autowired
    private ImageAssetPersistenceService imageAssetPersistenceService;

    @Autowired
    private ImageUploaderKeyFactory imageUploaderKeyFactory;

    @Autowired
    private ObjectMapper objectMapper;

    private Fish fish;

    @BeforeEach
    void setUp() {
        imageAssetRepository.deleteAll();
        reviewRepository.deleteAll();
        userRepository.deleteAll();
        fishRepository.deleteAll();
        fish = fishRepository.save(fish("광어"));
    }

    @AfterEach
    void tearDown() {
        imageAssetRepository.deleteAll();
        reviewRepository.deleteAll();
        userRepository.deleteAll();
        fishRepository.deleteAll();
    }

    @Test
    void helpfulIncrementsCountAndReviewListIncludesHelpfulCount() throws Exception {
        Review review = reviewRepository.save(review(fish, "회러버", 5, 4));

        mockMvc.perform(post("/api/v1/reviews/{id}/helpful", review.getId()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id", is(review.getId().intValue())))
                .andExpect(jsonPath("$.helpfulCount", is(5)));

        mockMvc.perform(get("/api/v1/fish/{id}/reviews", fish.getId()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.reviews[0].id", is(review.getId().intValue())))
                .andExpect(jsonPath("$.reviews[0].helpfulCount", is(5)))
                .andExpect(jsonPath("$.reviews[0].mine", is(false)));
    }

    @Test
    void helpfulIgnoresSpoofedForwardedHeaderForTheSameAnonymousPeer() throws Exception {
        Review review = reviewRepository.save(review(fish, "회러버", 5, 4));

        mockMvc.perform(post("/api/v1/reviews/{id}/helpful", review.getId())
                        .header("X-Forwarded-For", "192.0.2.250"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.helpfulCount", is(5)));

        mockMvc.perform(post("/api/v1/reviews/{id}/helpful", review.getId())
                        .header("X-Forwarded-For", "203.0.113.10"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.helpfulCount", is(5)));
    }

    @Test
    void helpfulSortReturnsHigherHelpfulCountFirst() throws Exception {
        reviewRepository.save(review(fish, "낮은추천", 4, 1));
        Review popular = reviewRepository.save(review(fish, "높은추천", 5, 8));

        mockMvc.perform(get("/api/v1/fish/{id}/reviews", fish.getId())
                        .param("sort", "helpful"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.reviews[0].id", is(popular.getId().intValue())))
                .andExpect(jsonPath("$.reviews[0].helpfulCount", is(8)));
    }

    @Test
    void reviewListIncludesRatingDistributionWithZeroBucketsAndTotalCountSum() throws Exception {
        reviewRepository.save(review(fish, "별다섯1", 5, 0));
        reviewRepository.save(review(fish, "별다섯2", 5, 0));
        reviewRepository.save(review(fish, "별셋", 3, 0));
        reviewRepository.save(review(fish, "별하나", 1, 0));

        String response = mockMvc.perform(get("/api/v1/fish/{id}/reviews", fish.getId()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalCount", is(4)))
                .andExpect(jsonPath("$.ratingDistribution['5']", is(2)))
                .andExpect(jsonPath("$.ratingDistribution['4']", is(0)))
                .andExpect(jsonPath("$.ratingDistribution['3']", is(1)))
                .andExpect(jsonPath("$.ratingDistribution['2']", is(0)))
                .andExpect(jsonPath("$.ratingDistribution['1']", is(1)))
                .andReturn()
                .getResponse()
                .getContentAsString();

        var root = objectMapper.readTree(response);
        int distributionSum = root.get("ratingDistribution").get("5").asInt()
                + root.get("ratingDistribution").get("4").asInt()
                + root.get("ratingDistribution").get("3").asInt()
                + root.get("ratingDistribution").get("2").asInt()
                + root.get("ratingDistribution").get("1").asInt();
        assertThat(distributionSum).isEqualTo(root.get("totalCount").asInt());
    }

    @Test
    void authenticatedCreateConnectsUserAndUsesMemberNicknameWithoutPassword() throws Exception {
        String token = signupAndLogin("member-review@example.com", "회원닉");
        Long userId = userRepository.findByEmail("member-review@example.com")
                .orElseThrow()
                .getId();
        PendingImage image = pendingImage(
                imageUploaderKeyFactory.forUser(userId),
                OffsetDateTime.now(ZoneOffset.UTC).plusHours(1));

        String response = mockMvc.perform(post("/api/v1/fish/{id}/reviews", fish.getId())
                        .header("Authorization", bearer(token))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of(
                                "nickname", "요청닉",
                                "rating", 5,
                                "content", "회원 후기",
                                "imageUrl", image.url(),
                                "imageAssetId", image.id()))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.nickname", is("회원닉")))
                .andExpect(jsonPath("$.imageUrl", is(image.url())))
                .andExpect(jsonPath("$.mine", is(true)))
                .andReturn()
                .getResponse()
                .getContentAsString();

        Long reviewId = objectMapper.readTree(response).get("id").asLong();
        Review saved = reviewRepository.findById(reviewId).orElseThrow();
        assertThat(saved.getUser()).isNotNull();
        assertThat(saved.getUser().getId()).isEqualTo(userId);
        assertThat(saved.getNickname()).isEqualTo("회원닉");
        assertThat(saved.getPasswordHash()).isNull();
        var attachedAsset = imageAssetRepository.findById(image.id()).orElseThrow();
        assertThat(attachedAsset.getStatus()).isEqualTo(ReviewImageAssetStatus.ATTACHED);
        assertThat(attachedAsset.getReview().getId()).isEqualTo(reviewId);
    }

    @Test
    void cachedUrlOnlyClientCanAttachExactTrackedAnonymousAsset() throws Exception {
        PendingImage image = pendingImage(
                imageUploaderKeyFactory.forAnonymous("127.0.0.1"),
                OffsetDateTime.now(ZoneOffset.UTC).plusHours(1));

        String response = mockMvc.perform(post("/api/v1/fish/{id}/reviews", fish.getId())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of(
                                "nickname", "익명",
                                "rating", 4,
                                "content", "URL 호환 후기",
                                "imageUrl", image.url(),
                                "password", "1234"))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.imageUrl", is(image.url())))
                .andReturn()
                .getResponse()
                .getContentAsString();

        Long reviewId = objectMapper.readTree(response).get("id").asLong();
        var asset = imageAssetRepository.findById(image.id()).orElseThrow();
        assertThat(asset.getStatus()).isEqualTo(ReviewImageAssetStatus.ATTACHED);
        assertThat(asset.getReview().getId()).isEqualTo(reviewId);
    }

    @Test
    void arbitraryOwnerMismatchedExpiredAndAlreadyAttachedAssetsAreRejectedAtomically()
            throws Exception {
        long initialReviewCount = reviewRepository.count();
        mockMvc.perform(post("/api/v1/fish/{id}/reviews", fish.getId())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of(
                                "nickname", "익명",
                                "content", "임의 URL",
                                "imageUrl", "https://res.cloudinary.com/demo/image/upload/untracked.jpg",
                                "password", "1234"))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message", is("imageUrl은 이미지 업로드로 발급된 자산만 사용할 수 있습니다.")));
        assertThat(reviewRepository.count()).isEqualTo(initialReviewCount);

        PendingImage otherOwner = pendingImage(
                imageUploaderKeyFactory.forAnonymous("203.0.113.99"),
                OffsetDateTime.now(ZoneOffset.UTC).plusHours(1));
        assertAssetRejected(otherOwner, "다른 업로더 자산");
        assertThat(imageAssetRepository.findById(otherOwner.id()).orElseThrow().getStatus())
                .isEqualTo(ReviewImageAssetStatus.PENDING);

        PendingImage expired = pendingImage(
                imageUploaderKeyFactory.forAnonymous("127.0.0.1"),
                OffsetDateTime.now(ZoneOffset.UTC).minusMinutes(1));
        assertAssetRejected(expired, "만료 자산");

        PendingImage singleUse = pendingImage(
                imageUploaderKeyFactory.forAnonymous("127.0.0.1"),
                OffsetDateTime.now(ZoneOffset.UTC).plusHours(1));
        createAnonymousReviewWithImage(singleUse, "첫 첨부");
        long countAfterFirstAttach = reviewRepository.count();
        assertAssetRejected(singleUse, "재사용 첨부");
        assertThat(reviewRepository.count()).isEqualTo(countAfterFirstAttach);
    }

    @Test
    void authenticatedUserCanDeleteOwnReviewWithoutPassword() throws Exception {
        String token = signupAndLogin("delete-mine@example.com", "삭제회원");
        Long reviewId = createAuthenticatedReview(token, "삭제할 회원 후기");

        mockMvc.perform(delete("/api/v1/reviews/{id}", reviewId)
                        .header("Authorization", bearer(token)))
                .andExpect(status().isNoContent());

        assertThat(reviewRepository.existsById(reviewId)).isFalse();
    }

    @Test
    void authenticatedReviewDeletionAtomicallyQueuesItsTrackedImage() throws Exception {
        String token = signupAndLogin("delete-image@example.com", "이미지삭제회원");
        Long userId = userRepository.findByEmail("delete-image@example.com").orElseThrow().getId();
        PendingImage image = pendingImage(
                imageUploaderKeyFactory.forUser(userId),
                OffsetDateTime.now(ZoneOffset.UTC).plusHours(1));
        Long reviewId = createAuthenticatedReviewWithImage(token, image, "이미지 회원 후기");

        mockMvc.perform(delete("/api/v1/reviews/{id}", reviewId)
                        .header("Authorization", bearer(token)))
                .andExpect(status().isNoContent());

        assertThat(reviewRepository.existsById(reviewId)).isFalse();
        var queuedAsset = imageAssetRepository.findById(image.id()).orElseThrow();
        assertThat(queuedAsset.getStatus()).isEqualTo(ReviewImageAssetStatus.DELETE_PENDING);
        assertThat(queuedAsset.getReview()).isNull();
        assertThat(queuedAsset.getDeletionClaimId()).isNull();
        assertThat(queuedAsset.getCleanupAvailableAt()).isNotNull();
        assertThat(queuedAsset.getCleanupAttempts()).isZero();
        assertThat(queuedAsset.getCleanupOriginStatus()).isEqualTo(ReviewImageAssetStatus.ATTACHED);
    }

    @Test
    void reviewListMarksOnlyRequesterReviewAsMine() throws Exception {
        String myToken = signupAndLogin("mine@example.com", "나");
        String otherToken = signupAndLogin("other@example.com", "남");
        Long myReviewId = createAuthenticatedReview(myToken, "내 후기");
        Long otherReviewId = createAuthenticatedReview(otherToken, "남의 후기");
        Long anonymousReviewId = createAnonymousReview("익명", "1234", "익명 후기");

        String response = mockMvc.perform(get("/api/v1/fish/{id}/reviews", fish.getId())
                        .header("Authorization", bearer(myToken)))
                .andExpect(status().isOk())
                .andReturn()
                .getResponse()
                .getContentAsString();

        assertThat(mineForReview(response, myReviewId)).isTrue();
        assertThat(mineForReview(response, otherReviewId)).isFalse();
        assertThat(mineForReview(response, anonymousReviewId)).isFalse();

        String anonymousResponse = mockMvc.perform(get("/api/v1/fish/{id}/reviews", fish.getId()))
                .andExpect(status().isOk())
                .andReturn()
                .getResponse()
                .getContentAsString();
        assertThat(mineForReview(anonymousResponse, myReviewId)).isFalse();
        assertThat(mineForReview(anonymousResponse, otherReviewId)).isFalse();
        assertThat(mineForReview(anonymousResponse, anonymousReviewId)).isFalse();
    }

    @Test
    void otherAuthenticatedUserCannotDeleteMemberReviewWithoutPasswordBypass() throws Exception {
        String ownerToken = signupAndLogin("owner@example.com", "작성자");
        String otherToken = signupAndLogin("not-owner@example.com", "다른회원");
        Long reviewId = createAuthenticatedReview(ownerToken, "남이 지우면 안 되는 후기");

        mockMvc.perform(delete("/api/v1/reviews/{id}", reviewId)
                        .header("Authorization", bearer(otherToken)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message", is("password는 필수입니다.")));

        mockMvc.perform(delete("/api/v1/reviews/{id}", reviewId)
                        .header("Authorization", bearer(otherToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("password", "1234"))))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.message", is("비밀번호가 일치하지 않습니다.")));
        assertThat(reviewRepository.existsById(reviewId)).isTrue();
    }

    @Test
    void anonymousReviewFlowStillRequiresNicknameAndPasswordAndDeletesByPassword() throws Exception {
        mockMvc.perform(post("/api/v1/fish/{id}/reviews", fish.getId())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of(
                                "nickname", "익명",
                                "rating", 4,
                                "content", "비밀번호 없는 익명 후기"))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message", is("password는 필수입니다.")));

        Long reviewId = createAnonymousReview("익명", "1234", "익명 후기");
        Review saved = reviewRepository.findById(reviewId).orElseThrow();
        assertThat(saved.getUser()).isNull();
        assertThat(saved.getPasswordHash()).isNotNull();
        assertThat(saved.getPasswordHash()).isNotEqualTo("1234");

        mockMvc.perform(delete("/api/v1/reviews/{id}", reviewId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("password", "wrong"))))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.message", is("비밀번호가 일치하지 않습니다.")));

        mockMvc.perform(delete("/api/v1/reviews/{id}", reviewId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("password", "1234"))))
                .andExpect(status().isNoContent());
        assertThat(reviewRepository.existsById(reviewId)).isFalse();
    }

    @Test
    void anonymousImageReviewOnlyQueuesDeletionAfterPasswordSucceeds() throws Exception {
        PendingImage image = pendingImage(
                imageUploaderKeyFactory.forAnonymous("127.0.0.1"),
                OffsetDateTime.now(ZoneOffset.UTC).plusHours(1));
        Long reviewId = createAnonymousReviewWithImage(image, "비밀번호 이미지 후기");

        mockMvc.perform(delete("/api/v1/reviews/{id}", reviewId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("password", "wrong"))))
                .andExpect(status().isForbidden());

        var attachedAsset = imageAssetRepository.findById(image.id()).orElseThrow();
        assertThat(attachedAsset.getStatus()).isEqualTo(ReviewImageAssetStatus.ATTACHED);
        assertThat(attachedAsset.getReview().getId()).isEqualTo(reviewId);

        mockMvc.perform(delete("/api/v1/reviews/{id}", reviewId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("password", "1234"))))
                .andExpect(status().isNoContent());

        var queuedAsset = imageAssetRepository.findById(image.id()).orElseThrow();
        assertThat(queuedAsset.getStatus()).isEqualTo(ReviewImageAssetStatus.DELETE_PENDING);
        assertThat(queuedAsset.getReview()).isNull();
        assertThat(queuedAsset.getCleanupAvailableAt()).isNotNull();
        assertThat(queuedAsset.getCleanupAttempts()).isZero();
    }

    @Test
    void reviewAndTrackedImageRollBackTogetherWhenDeletionFailsAfterAssetFlush() throws Exception {
        PendingImage image = pendingImage(
                imageUploaderKeyFactory.forAnonymous("127.0.0.1"),
                OffsetDateTime.now(ZoneOffset.UTC).plusHours(1));
        Long reviewId = createAnonymousReviewWithImage(image, "원자적 롤백 후기");
        doThrow(new IllegalStateException("forced review deletion failure"))
                .when(reviewRepository)
                .delete(argThat(review -> reviewId.equals(review.getId())));

        assertThatThrownBy(() -> reviewService.deleteReview(reviewId, null, "1234"))
                .isInstanceOf(IllegalStateException.class)
                .hasMessage("forced review deletion failure");

        assertThat(reviewRepository.existsById(reviewId)).isTrue();
        var attachedAsset = imageAssetRepository.findById(image.id()).orElseThrow();
        assertThat(attachedAsset.getStatus()).isEqualTo(ReviewImageAssetStatus.ATTACHED);
        assertThat(attachedAsset.getReview().getId()).isEqualTo(reviewId);
        assertThat(attachedAsset.getCleanupAvailableAt()).isNull();
        assertThat(attachedAsset.getCleanupOriginStatus()).isNull();
    }

    private Fish fish(String name) {
        Fish fish = new Fish();
        fish.setName(name);
        fish.setNameEn(name);
        fish.setDescription(name + " 설명");
        fish.setPriceLevel((short) 2);
        fish.getSeasonMonths().addAll(Set.of((short) 1, (short) 12));
        fish.getTasteTags().addAll(Set.of("담백", "쫄깃"));
        return fish;
    }

    private Review review(Fish fish, String nickname, int rating, int helpfulCount) {
        Review review = new Review();
        review.setFish(fish);
        review.setNickname(nickname);
        review.setRating((short) rating);
        review.setContent(nickname + " 후기");
        review.setPasswordHash("password-hash");
        review.setHelpfulCount(helpfulCount);
        return review;
    }

    private String signupAndLogin(String email, String nickname) throws Exception {
        mockMvc.perform(post("/api/v1/auth/signup")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of(
                                "email", email,
                                "password", "password123",
                                "nickname", nickname))))
                .andExpect(status().isCreated());

        String loginResponse = mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of(
                                "email", email,
                                "password", "password123"))))
                .andExpect(status().isOk())
                .andReturn()
                .getResponse()
                .getContentAsString();
        return objectMapper.readTree(loginResponse).get("accessToken").asText();
    }

    private Long createAuthenticatedReview(String token, String content) throws Exception {
        String response = mockMvc.perform(post("/api/v1/fish/{id}/reviews", fish.getId())
                        .header("Authorization", bearer(token))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of(
                                "nickname", "무시될닉네임",
                                "rating", 5,
                                "content", content))))
                .andExpect(status().isCreated())
                .andReturn()
                .getResponse()
                .getContentAsString();
        return objectMapper.readTree(response).get("id").asLong();
    }

    private Long createAuthenticatedReviewWithImage(
            String token,
            PendingImage image,
            String content) throws Exception {
        String response = mockMvc.perform(post("/api/v1/fish/{id}/reviews", fish.getId())
                        .header("Authorization", bearer(token))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of(
                                "nickname", "무시될닉네임",
                                "rating", 5,
                                "content", content,
                                "imageUrl", image.url(),
                                "imageAssetId", image.id()))))
                .andExpect(status().isCreated())
                .andReturn()
                .getResponse()
                .getContentAsString();
        return objectMapper.readTree(response).get("id").asLong();
    }

    private Long createAnonymousReview(String nickname, String password, String content) throws Exception {
        String response = mockMvc.perform(post("/api/v1/fish/{id}/reviews", fish.getId())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of(
                                "nickname", nickname,
                                "rating", 4,
                                "content", content,
                                "password", password))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.mine", is(false)))
                .andReturn()
                .getResponse()
                .getContentAsString();
        return objectMapper.readTree(response).get("id").asLong();
    }

    private Long createAnonymousReviewWithImage(PendingImage image, String content) throws Exception {
        String response = mockMvc.perform(post("/api/v1/fish/{id}/reviews", fish.getId())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of(
                                "nickname", "익명",
                                "rating", 4,
                                "content", content,
                                "imageUrl", image.url(),
                                "imageAssetId", image.id(),
                                "password", "1234"))))
                .andExpect(status().isCreated())
                .andReturn()
                .getResponse()
                .getContentAsString();
        return objectMapper.readTree(response).get("id").asLong();
    }

    private void assertAssetRejected(PendingImage image, String content) throws Exception {
        long before = reviewRepository.count();
        mockMvc.perform(post("/api/v1/fish/{id}/reviews", fish.getId())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of(
                                "nickname", "익명",
                                "rating", 4,
                                "content", content,
                                "imageUrl", image.url(),
                                "imageAssetId", image.id(),
                                "password", "1234"))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message", is("imageUrl은 이미지 업로드로 발급된 자산만 사용할 수 있습니다.")));
        assertThat(reviewRepository.count()).isEqualTo(before);
    }

    private PendingImage pendingImage(String uploaderKey, OffsetDateTime expiresAt) {
        UUID id = UUID.randomUUID();
        String publicId = "fishnote/reviews/" + id;
        String url = "https://res.cloudinary.com/test-cloud/image/upload/" + publicId + ".jpg";
        imageAssetPersistenceService.reserve(id, publicId, uploaderKey, expiresAt);
        imageAssetPersistenceService.completeUpload(
                id,
                publicId,
                url,
                expiresAt.minusHours(1),
                expiresAt);
        return new PendingImage(id, url);
    }

    private boolean mineForReview(String response, Long reviewId) throws Exception {
        for (var review : objectMapper.readTree(response).get("reviews")) {
            if (review.get("id").asLong() == reviewId) {
                return review.get("mine").asBoolean();
            }
        }
        throw new AssertionError("응답에서 후기를 찾을 수 없습니다: " + reviewId);
    }

    private String bearer(String token) {
        return "Bearer " + token;
    }

    private String json(Object body) throws Exception {
        return objectMapper.writeValueAsString(body);
    }

    private record PendingImage(UUID id, String url) {
    }
}
