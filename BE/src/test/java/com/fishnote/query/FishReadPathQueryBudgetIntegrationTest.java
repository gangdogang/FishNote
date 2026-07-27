package com.fishnote.query;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fishnote.fish.Fish;
import com.fishnote.fish.FishCategory;
import com.fishnote.fish.FishRepository;
import com.fishnote.fish.FishV2Service;
import com.fishnote.fish.dto.FishCatalogResponse;
import com.fishnote.review.Review;
import com.fishnote.review.ReviewRepository;
import com.fishnote.review.ReviewV2Service;
import com.fishnote.review.dto.ReviewCursorListResponse;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import javax.sql.DataSource;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.boot.autoconfigure.jdbc.DataSourceProperties;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest
@ActiveProfiles("test")
@AutoConfigureMockMvc
class FishReadPathQueryBudgetIntegrationTest {

    @TestConfiguration(proxyBeanMethods = false)
    static class CountingDataSourceConfiguration {

        @Bean
        @Primary
        SqlStatementCounter countingDataSource(DataSourceProperties properties) {
            DriverManagerDataSource target = new DriverManagerDataSource();
            target.setDriverClassName(properties.determineDriverClassName());
            target.setUrl(properties.determineUrl() + ";DB_CLOSE_DELAY=-1");
            target.setUsername(properties.determineUsername());
            target.setPassword(properties.determinePassword());
            return new SqlStatementCounter(target);
        }

        @Bean
        DataSource dataSource(SqlStatementCounter countingDataSource) {
            return countingDataSource;
        }
    }

    private final FishRepository fishRepository;
    private final ReviewRepository reviewRepository;
    private final FishV2Service fishService;
    private final ReviewV2Service reviewService;
    private final SqlStatementCounter statementCounter;
    private final MockMvc mockMvc;

    private Long detailFishId;

    @Autowired
    FishReadPathQueryBudgetIntegrationTest(
            FishRepository fishRepository,
            ReviewRepository reviewRepository,
            FishV2Service fishService,
            ReviewV2Service reviewService,
            SqlStatementCounter statementCounter,
            MockMvc mockMvc) {
        this.fishRepository = fishRepository;
        this.reviewRepository = reviewRepository;
        this.fishService = fishService;
        this.reviewService = reviewService;
        this.statementCounter = statementCounter;
        this.mockMvc = mockMvc;
    }

    @BeforeEach
    void setUp() {
        reviewRepository.deleteAll();
        fishRepository.deleteAll();

        List<Fish> fishes = new ArrayList<>();
        for (int index = 1; index <= 101; index++) {
            Fish fish = new Fish();
            fish.setName("테스트어종" + String.format("%03d", index));
            fish.setSlug("query-budget-fish-" + index);
            fish.setCategory(FishCategory.FISH);
            fish.setDescription("조회 예산 fixture");
            fish.setPriceLevel((short) ((index % 3) + 1));
            fish.setFeatured(index % 2 == 0);
            for (short month = 1; month <= 12; month++) {
                fish.getSeasonMonths().add(month);
            }
            fish.getTasteTags().addAll(Set.of("담백", "고소", "쫄깃", "기름진", "감칠맛"));
            fishes.add(fish);
        }
        fishRepository.saveAllAndFlush(fishes);

        Fish detailFish = fishes.get(0);
        detailFish.getSimilarFishes().addAll(fishes.subList(1, 11));
        fishRepository.saveAndFlush(detailFish);
        detailFishId = detailFish.getId();

        for (int index = 0; index < 25; index++) {
            Review review = new Review();
            review.setFish(detailFish);
            review.setNickname("reviewer-" + index);
            review.setContent("후기 " + index);
            review.setRating(index % 4 == 0 ? null : (short) ((index % 5) + 1));
            review.setHelpfulCount(index % 7);
            reviewRepository.save(review);
        }
        reviewRepository.flush();
        statementCounter.clear();
    }

    @Test
    void catalogPageStaysWithinFourSelectsWithMoreThanOneBatchOfFish() {
        FishCatalogResponse response = fishService.findFishes(
                null, null, null, null, null, null, null, "popular", 24, null);

        assertThat(response.items()).hasSize(24);
        assertThat(response.pageInfo().hasNext()).isTrue();
        assertThat(response.facets().taste()).containsKey("담백");
        assertThat(statementCounter.selectCount()).isLessThanOrEqualTo(4);
    }

    @Test
    void detailWithTwelveSeasonsFiveTastesAndTenSimilarStaysWithinThreeSelects() {
        var response = fishService.getFish(detailFishId.toString());

        assertThat(response.seasonMonths()).hasSize(12);
        assertThat(response.tasteTags()).hasSize(5);
        assertThat(response.similarFishes()).hasSize(10);
        assertThat(response.ratingCount()).isPositive();
        assertThat(statementCounter.selectCount()).isLessThanOrEqualTo(3);
    }

    @Test
    void firstReviewPageUsesTwoSelectsAndFollowingPageUsesOne() {
        ReviewCursorListResponse first = reviewService.findReviews(
                detailFishId, "latest", 10, null, true, null);

        assertThat(first.summary()).isNotNull();
        assertThat(first.items()).hasSize(10);
        assertThat(statementCounter.selectCount()).isLessThanOrEqualTo(2);

        statementCounter.clear();
        ReviewCursorListResponse second = reviewService.findReviews(
                detailFishId, "latest", 10, first.pageInfo().nextCursor(), false, null);

        assertThat(second.summary()).isNull();
        assertThat(second.items()).hasSize(10);
        assertThat(statementCounter.selectCount()).isLessThanOrEqualTo(1);
    }

    @Test
    void nameAndReviewCursorsHaveNoDuplicatesOrOmissions() {
        Set<Long> fishIds = new HashSet<>();
        String fishCursor = null;
        do {
            FishCatalogResponse page = fishService.findFishes(
                    null, null, null, null, null, null, null, "name", 13, fishCursor);
            assertThat(page.items()).allSatisfy(item -> assertThat(fishIds.add(item.id())).isTrue());
            fishCursor = page.pageInfo().nextCursor();
        } while (fishCursor != null);
        assertThat(fishIds).hasSize(101);

        Set<Long> reviewIds = new HashSet<>();
        String reviewCursor = null;
        do {
            ReviewCursorListResponse page = reviewService.findReviews(
                    detailFishId, "helpful", 6, reviewCursor, false, null);
            assertThat(page.items()).allSatisfy(item -> assertThat(reviewIds.add(item.id())).isTrue());
            reviewCursor = page.pageInfo().nextCursor();
        } while (reviewCursor != null);
        assertThat(reviewIds).hasSize(25);
    }

    @Test
    void ratinglessReviewsExposeRatingCountZeroInsteadOfAFakeStarAverage() {
        Fish fish = new Fish();
        fish.setName("별점없는어종");
        fish.setSlug("ratingless-fish");
        fish.setCategory(FishCategory.FISH);
        fishRepository.saveAndFlush(fish);

        Review review = new Review();
        review.setFish(fish);
        review.setNickname("별점없음");
        review.setContent("내용만 남긴 후기");
        review.setRating(null);
        reviewRepository.saveAndFlush(review);

        var detail = fishService.getFish(fish.getId().toString());
        ReviewCursorListResponse reviews = reviewService.findReviews(
                fish.getId(), "latest", 20, null, true, null);

        assertThat(detail.reviewCount()).isOne();
        assertThat(detail.ratingCount()).isZero();
        assertThat(reviews.summary().ratingCount()).isZero();
        assertThat(reviews.summary().avgRating()).isNull();
    }

    @Test
    void malformedCursorUsesTheStandardInvalidCursorError() throws Exception {
        mockMvc.perform(get("/api/v2/fish").param("cursor", "not-a-json-cursor"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_CURSOR"))
                .andExpect(jsonPath("$.fieldErrors.cursor").exists())
                .andExpect(jsonPath("$.traceId").isNotEmpty());
    }
}
