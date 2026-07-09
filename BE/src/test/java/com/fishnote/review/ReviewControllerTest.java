package com.fishnote.review;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.is;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fishnote.fish.Fish;
import com.fishnote.fish.FishRepository;
import com.fishnote.user.UserRepository;
import java.util.Map;
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
class ReviewControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private FishRepository fishRepository;

    @Autowired
    private ReviewRepository reviewRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private ObjectMapper objectMapper;

    private Fish fish;

    @BeforeEach
    void setUp() {
        reviewRepository.deleteAll();
        userRepository.deleteAll();
        fishRepository.deleteAll();
        fish = fishRepository.save(fish("광어"));
    }

    @AfterEach
    void tearDown() {
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

        String response = mockMvc.perform(post("/api/v1/fish/{id}/reviews", fish.getId())
                        .header("Authorization", bearer(token))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of(
                                "nickname", "요청닉",
                                "rating", 5,
                                "content", "회원 후기",
                                "imageUrl", "https://example.com/review.jpg"))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.nickname", is("회원닉")))
                .andExpect(jsonPath("$.mine", is(true)))
                .andReturn()
                .getResponse()
                .getContentAsString();

        Long reviewId = objectMapper.readTree(response).get("id").asLong();
        Long userId = userRepository.findByEmail("member-review@example.com")
                .orElseThrow()
                .getId();
        Review saved = reviewRepository.findById(reviewId).orElseThrow();
        assertThat(saved.getUser()).isNotNull();
        assertThat(saved.getUser().getId()).isEqualTo(userId);
        assertThat(saved.getNickname()).isEqualTo("회원닉");
        assertThat(saved.getPasswordHash()).isNull();
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
}
