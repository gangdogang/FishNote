package com.fishnote.bookmark;

import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.notNullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fishnote.fish.Fish;
import com.fishnote.fish.FishRepository;
import com.fishnote.review.Review;
import com.fishnote.review.ReviewRepository;
import com.fishnote.user.UserRepository;
import java.util.List;
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
class BookmarkControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private FishRepository fishRepository;

    @Autowired
    private ReviewRepository reviewRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private UserBookmarkRepository bookmarkRepository;

    private Fish flounder;
    private Fish yellowtail;
    private Fish seabream;

    @BeforeEach
    void setUp() {
        bookmarkRepository.deleteAll();
        reviewRepository.deleteAll();
        userRepository.deleteAll();
        fishRepository.deleteAll();

        flounder = fishRepository.save(fish("광어"));
        yellowtail = fishRepository.save(fish("방어"));
        seabream = fishRepository.save(fish("참돔"));
    }

    @AfterEach
    void tearDown() {
        bookmarkRepository.deleteAll();
        reviewRepository.deleteAll();
        userRepository.deleteAll();
        fishRepository.deleteAll();
    }

    @Test
    void addListAndDeleteBookmarks() throws Exception {
        String token = signupAndLogin("bookmark@example.com");
        reviewRepository.save(review(flounder, 5));
        reviewRepository.save(review(flounder, 4));

        mockMvc.perform(put("/api/v1/me/bookmarks/{fishId}", flounder.getId())
                        .header("Authorization", bearer(token)))
                .andExpect(status().isNoContent());
        mockMvc.perform(put("/api/v1/me/bookmarks/{fishId}", flounder.getId())
                        .header("Authorization", bearer(token)))
                .andExpect(status().isNoContent());
        mockMvc.perform(put("/api/v1/me/bookmarks/{fishId}", yellowtail.getId())
                        .header("Authorization", bearer(token)))
                .andExpect(status().isNoContent());

        mockMvc.perform(get("/api/v1/me/bookmarks")
                        .header("Authorization", bearer(token)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()", is(2)))
                .andExpect(jsonPath("$[0].id", is(flounder.getId().intValue())))
                .andExpect(jsonPath("$[0].name", is("광어")))
                .andExpect(jsonPath("$[0].avgRating", is(4.5)))
                .andExpect(jsonPath("$[0].reviewCount", is(2)))
                .andExpect(jsonPath("$[1].id", is(yellowtail.getId().intValue())));

        mockMvc.perform(delete("/api/v1/me/bookmarks/{fishId}", flounder.getId())
                        .header("Authorization", bearer(token)))
                .andExpect(status().isNoContent());
        mockMvc.perform(delete("/api/v1/me/bookmarks/{fishId}", flounder.getId())
                        .header("Authorization", bearer(token)))
                .andExpect(status().isNoContent());

        mockMvc.perform(get("/api/v1/me/bookmarks")
                        .header("Authorization", bearer(token)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()", is(1)))
                .andExpect(jsonPath("$[0].id", is(yellowtail.getId().intValue())));
    }

    @Test
    void addUnknownFishReturnsNotFound() throws Exception {
        String token = signupAndLogin("missing-fish@example.com");

        mockMvc.perform(put("/api/v1/me/bookmarks/{fishId}", 999_999L)
                        .header("Authorization", bearer(token)))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.message", is("생선을 찾을 수 없습니다.")));
    }

    @Test
    void mergeAddsOnlyExistingFishesAndIgnoresDuplicates() throws Exception {
        String token = signupAndLogin("merge@example.com");

        mockMvc.perform(post("/api/v1/me/bookmarks/merge")
                        .header("Authorization", bearer(token))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("fishIds", List.of(999_999L, seabream.getId(), seabream.getId(), flounder.getId())))))
                .andExpect(status().isNoContent());

        mockMvc.perform(get("/api/v1/me/bookmarks")
                        .header("Authorization", bearer(token)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()", is(2)))
                .andExpect(jsonPath("$[0].id", is(seabream.getId().intValue())))
                .andExpect(jsonPath("$[1].id", is(flounder.getId().intValue())));
    }

    @Test
    void bookmarkEndpointsRequireAuthentication() throws Exception {
        mockMvc.perform(get("/api/v1/me/bookmarks"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.message", is("인증이 필요합니다.")));
        mockMvc.perform(put("/api/v1/me/bookmarks/{fishId}", flounder.getId()))
                .andExpect(status().isUnauthorized());
        mockMvc.perform(delete("/api/v1/me/bookmarks/{fishId}", flounder.getId()))
                .andExpect(status().isUnauthorized());
        mockMvc.perform(post("/api/v1/me/bookmarks/merge")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("fishIds", List.of(flounder.getId())))))
                .andExpect(status().isUnauthorized());
    }

    private String signupAndLogin(String email) throws Exception {
        mockMvc.perform(post("/api/v1/auth/signup")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of(
                                "email", email,
                                "password", "password123",
                                "nickname", "회러버"))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id", notNullValue()));

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

    private Fish fish(String name) {
        Fish fish = new Fish();
        fish.setName(name);
        fish.setNameEn(name);
        fish.setImageUrl(name + " 대표 이미지");
        fish.setDescription(name + " 설명");
        fish.setPriceLevel((short) 2);
        fish.getSeasonMonths().addAll(Set.of((short) 1, (short) 12));
        fish.getTasteTags().addAll(Set.of("담백", "쫄깃"));
        return fish;
    }

    private Review review(Fish fish, int rating) {
        Review review = new Review();
        review.setFish(fish);
        review.setNickname("테스터" + rating);
        review.setRating((short) rating);
        review.setContent("별점 " + rating + " 후기");
        review.setPasswordHash("password-hash");
        return review;
    }

    private String bearer(String token) {
        return "Bearer " + token;
    }

    private String json(Object body) throws Exception {
        return objectMapper.writeValueAsString(body);
    }
}
