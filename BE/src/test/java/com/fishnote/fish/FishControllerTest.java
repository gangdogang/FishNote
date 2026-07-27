package com.fishnote.fish;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsInAnyOrder;
import static org.hamcrest.Matchers.everyItem;
import static org.hamcrest.Matchers.hasKey;
import static org.hamcrest.Matchers.is;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fishnote.review.Review;
import com.fishnote.review.ReviewRepository;
import java.util.List;
import java.util.Map;
import java.util.Set;
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
class FishControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private FishRepository fishRepository;

    @Autowired
    private ReviewRepository reviewRepository;

    @Autowired
    private ObjectMapper objectMapper;

    @BeforeEach
    void setUp() {
        reviewRepository.deleteAll();
        fishRepository.deleteAll();
        Fish flounder = fish("광어", false, (short) 2, Set.of((short) 12, (short) 1), Set.of("담백", "쫄깃"));
        flounder.addAlias("광어", FishAliasType.STANDARD);
        flounder.addAlias("넙치", FishAliasType.MARKET);
        flounder.getImages().addAll(List.of("광어 갤러리 1", "광어 갤러리 2", "광어 갤러리 3"));
        flounder.getTips().addAll(List.of("첫 번째 팁", "두 번째 팁"));
        Fish yellowtail = fish("방어", true, (short) 3, Set.of((short) 12, (short) 1), Set.of("고소", "기름진"));
        Fish seabream = fish("참돔", true, (short) 3, Set.of((short) 4, (short) 5), Set.of("담백", "고급"));
        yellowtail.addAlias("방어", FishAliasType.STANDARD);
        seabream.addAlias("참돔", FishAliasType.STANDARD);
        seabream.addAlias("도미", FishAliasType.MARKET);
        flounder.getSimilarFishes().addAll(Set.of(yellowtail, seabream));
        fishRepository.save(yellowtail);
        fishRepository.save(seabream);
        fishRepository.save(flounder);
    }

    @Test
    void featuredTrueReturnsOnlyEditorsPicksAndIncludesFeaturedField() throws Exception {
        mockMvc.perform(get("/api/v1/fish")
                        .param("featured", "true")
                        .param("sort", "name"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[*].name", containsInAnyOrder("방어", "참돔")))
                .andExpect(jsonPath("$[*].featured", everyItem(is(true))))
                .andExpect(jsonPath("$[0]", hasKey("featured")));
    }

    @Test
    void monthReturnsOnlyFishesInSeasonForThatMonth() throws Exception {
        mockMvc.perform(get("/api/v1/fish")
                        .param("month", "12")
                        .param("sort", "name"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[*].name", containsInAnyOrder("광어", "방어")));
    }

    @Test
    void featuredAndMonthCombineWithExistingFilters() throws Exception {
        mockMvc.perform(get("/api/v1/fish")
                        .param("featured", "true")
                        .param("month", "12")
                        .param("taste", "고소")
                        .param("priceLevel", "3")
                        .param("sort", "name"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].name", is("방어")))
                .andExpect(jsonPath("$[0].featured", is(true)))
                .andExpect(jsonPath("$.length()", is(1)));
    }

    @Test
    void detailIncludesTipsInStoredOrder() throws Exception {
        Fish fish = fishRepository.findAll().stream()
                .filter(savedFish -> savedFish.getName().equals("광어"))
                .findFirst()
                .orElseThrow();

        mockMvc.perform(get("/api/v1/fish/{id}", fish.getId()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.tips[0]", is("첫 번째 팁")))
                .andExpect(jsonPath("$.tips[1]", is("두 번째 팁")))
                .andExpect(jsonPath("$.tips.length()", is(2)));
    }

    @Test
    void detailIncludesImagesInStoredOrder() throws Exception {
        Fish fish = fishRepository.findAll().stream()
                .filter(savedFish -> savedFish.getName().equals("광어"))
                .findFirst()
                .orElseThrow();

        mockMvc.perform(get("/api/v1/fish/{id}", fish.getId()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.images[0]", is("광어 갤러리 1")))
                .andExpect(jsonPath("$.images[1]", is("광어 갤러리 2")))
                .andExpect(jsonPath("$.images[2]", is("광어 갤러리 3")))
                .andExpect(jsonPath("$.images.length()", is(3)));
    }

    @Test
    void detailFallsBackToImageUrlWhenGalleryImagesAreEmpty() throws Exception {
        Fish fish = fishRepository.findAll().stream()
                .filter(savedFish -> savedFish.getName().equals("방어"))
                .findFirst()
                .orElseThrow();

        mockMvc.perform(get("/api/v1/fish/{id}", fish.getId()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.images[0]", is("방어 대표 이미지")))
                .andExpect(jsonPath("$.images.length()", is(1)));
    }

    @Test
    void detailIncludesRatingDistributionMatchingReviewCount() throws Exception {
        Fish fish = fishRepository.findAll().stream()
                .filter(savedFish -> savedFish.getName().equals("광어"))
                .findFirst()
                .orElseThrow();
        reviewRepository.save(review(fish, 5));
        reviewRepository.save(review(fish, 4));
        reviewRepository.save(review(fish, 1));

        String response = mockMvc.perform(get("/api/v1/fish/{id}", fish.getId()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.reviewCount", is(3)))
                .andExpect(jsonPath("$.ratingDistribution['5']", is(1)))
                .andExpect(jsonPath("$.ratingDistribution['4']", is(1)))
                .andExpect(jsonPath("$.ratingDistribution['3']", is(0)))
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
        assertThat(distributionSum).isEqualTo(root.get("reviewCount").asInt());
    }

    @Test
    void detailIncludesExpandedSimilarFishFields() throws Exception {
        Fish flounder = fishRepository.findAll().stream()
                .filter(savedFish -> savedFish.getName().equals("광어"))
                .findFirst()
                .orElseThrow();
        Fish yellowtail = fishRepository.findAll().stream()
                .filter(savedFish -> savedFish.getName().equals("방어"))
                .findFirst()
                .orElseThrow();
        reviewRepository.save(review(yellowtail, 5));
        reviewRepository.save(review(yellowtail, 4));

        mockMvc.perform(get("/api/v1/fish/{id}", flounder.getId()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.similarFishes.length()", is(2)))
                .andExpect(jsonPath("$.similarFishes[0].name", is("방어")))
                .andExpect(jsonPath("$.similarFishes[0].priceLevel", is(3)))
                .andExpect(jsonPath("$.similarFishes[0].avgRating", is(4.5)))
                .andExpect(jsonPath("$.similarFishes[0].seasonMonths", containsInAnyOrder(1, 12)))
                .andExpect(jsonPath("$.similarFishes[1].name", is("참돔")))
                .andExpect(jsonPath("$.similarFishes[1].priceLevel", is(3)))
                .andExpect(jsonPath("$.similarFishes[1].avgRating", is(0.0)))
                .andExpect(jsonPath("$.similarFishes[1].seasonMonths", containsInAnyOrder(4, 5)));
    }

    @Test
    void aliasSearchFindsTheCanonicalCatalogEntry() throws Exception {
        Fish pikeConger = aliasFish("갯장어", "gaetjangeo", "하모");
        Fish conger = aliasFish("붕장어", "bungjangeo", "아나고");
        Fish redMullet = aliasFish("가숭어", "gasungeo", "밀치");
        fishRepository.saveAll(List.of(pikeConger, conger, redMullet));

        for (Map.Entry<String, String> expected : Map.of(
                        "넙치", "광어",
                        "도미", "참돔",
                        "하모", "갯장어",
                        "아나고", "붕장어",
                        "밀치", "가숭어")
                .entrySet()) {
            mockMvc.perform(get("/api/v1/fish")
                            .param("search", expected.getKey())
                            .param("sort", "name"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.length()", is(1)))
                    .andExpect(jsonPath("$[0].name", is(expected.getValue())))
                    .andExpect(jsonPath("$[0].category", is("FISH")));
        }
    }

    @Test
    void suggestionsExposeMatchedAliasAndCanonicalName() throws Exception {
        mockMvc.perform(get("/api/v1/fish/suggestions")
                        .param("q", "도미")
                        .param("limit", "8"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items.length()", is(1)))
                .andExpect(jsonPath("$.items[0].name", is("참돔")))
                .andExpect(jsonPath("$.items[0].slug", is("chamdom")))
                .andExpect(jsonPath("$.items[0].matchedAlias", is("도미")));
    }

    @Test
    void priceAliasManifestIsDbDerivedAndDeterministicallyOrdered() throws Exception {
        mockMvc.perform(get("/api/v1/fish/aliases/price-parser"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.schemaVersion", is(1)))
                .andExpect(jsonPath("$.source", is("fish_alias")))
                .andExpect(jsonPath("$.items.length()", is(5)))
                .andExpect(jsonPath("$.items[0].alias", is("광어")))
                .andExpect(jsonPath("$.items[0].canonicalFishName", is("광어")))
                .andExpect(jsonPath("$.items[1].alias", is("넙치")))
                .andExpect(jsonPath("$.items[1].canonicalFishName", is("광어")))
                .andExpect(jsonPath("$.items[2].alias", is("도미")))
                .andExpect(jsonPath("$.items[2].canonicalFishName", is("참돔")))
                .andExpect(jsonPath("$.items[3].alias", is("방어")))
                .andExpect(jsonPath("$.items[4].alias", is("참돔")));
    }

    @Test
    void suggestionsRequireTwoCharactersAndBoundedLimit() throws Exception {
        mockMvc.perform(get("/api/v1/fish/suggestions").param("q", "돔"))
                .andExpect(status().isBadRequest());

        mockMvc.perform(get("/api/v1/fish/suggestions")
                        .param("q", "도미")
                        .param("limit", "21"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void suggestionsReturnStandardBadRequestForInvalidParameters() throws Exception {
        mockMvc.perform(get("/api/v1/fish/suggestions"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status", is(400)))
                .andExpect(jsonPath("$.error", is("Bad Request")))
                .andExpect(jsonPath("$.message", is("필수 요청 값이 누락되었습니다.")))
                .andExpect(jsonPath("$.path", is("/api/v1/fish/suggestions")));

        mockMvc.perform(get("/api/v1/fish/suggestions").param("q", ""))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status", is(400)))
                .andExpect(jsonPath("$.error", is("Bad Request")))
                .andExpect(jsonPath("$.message", is("검색어는 2~80자여야 합니다.")))
                .andExpect(jsonPath("$.path", is("/api/v1/fish/suggestions")));

        mockMvc.perform(get("/api/v1/fish/suggestions")
                        .param("q", "도미")
                        .param("limit", "not-a-number"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status", is(400)))
                .andExpect(jsonPath("$.error", is("Bad Request")))
                .andExpect(jsonPath("$.message", is("경로 또는 쿼리 값이 올바르지 않습니다.")))
                .andExpect(jsonPath("$.path", is("/api/v1/fish/suggestions")));
    }

    @Test
    void numericIdAndSlugReturnTheSameDetailAndAliases() throws Exception {
        Fish flounder = fishRepository.findByName("광어").orElseThrow();

        mockMvc.perform(get("/api/v1/fish/{identifier}", flounder.getId()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id", is(flounder.getId().intValue())))
                .andExpect(jsonPath("$.slug", is("gwangeo")))
                .andExpect(jsonPath("$.aliases", containsInAnyOrder("넙치")));

        mockMvc.perform(get("/api/v1/fish/{identifier}", "gwangeo"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id", is(flounder.getId().intValue())))
                .andExpect(jsonPath("$.slug", is("gwangeo")))
                .andExpect(jsonPath("$.name", is("광어")));
    }

    private Fish fish(String name, boolean featured, Short priceLevel, Set<Short> seasonMonths, Set<String> tasteTags) {
        Fish fish = new Fish();
        fish.setName(name);
        fish.setSlug(switch (name) {
            case "광어" -> "gwangeo";
            case "방어" -> "bangeo";
            case "참돔" -> "chamdom";
            default -> "test-" + name;
        });
        fish.setNameEn(name);
        fish.setImageUrl(name + " 대표 이미지");
        fish.setDescription(name + " 설명");
        fish.setPriceLevel(priceLevel);
        fish.setFeatured(featured);
        fish.getSeasonMonths().addAll(seasonMonths);
        fish.getTasteTags().addAll(tasteTags);
        return fish;
    }

    private Fish aliasFish(String name, String slug, String alias) {
        Fish fish = fish(name, false, (short) 2, Set.of(), Set.of());
        fish.setSlug(slug);
        fish.addAlias(name, FishAliasType.STANDARD);
        fish.addAlias(alias, FishAliasType.MARKET);
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
}
