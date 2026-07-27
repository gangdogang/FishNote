package com.fishnote.fish;

import static org.hamcrest.Matchers.containsInAnyOrder;
import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.nullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fishnote.review.ReviewRepository;
import java.util.List;
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
class FishSuggestionRankingTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private FishRepository fishRepository;

    @Autowired
    private ReviewRepository reviewRepository;

    @BeforeEach
    void setUp() {
        reviewRepository.deleteAll();
        fishRepository.deleteAll();
    }

    @Test
    void ranksOneAliasPerFishBeforeApplyingLimit() throws Exception {
        Fish crowded = fish("다중후보", "many-matches");
        for (int index = 9; index >= 0; index--) {
            crowded.addAlias("aa%02d".formatted(index), FishAliasType.MARKET);
        }
        Fish trailing = fish("후순위후보", "later-match");
        trailing.addAlias("aa-very-long", FishAliasType.MARKET);
        fishRepository.saveAllAndFlush(List.of(crowded, trailing));

        mockMvc.perform(get("/api/v1/fish/suggestions")
                        .param("q", "aa")
                .param("limit", "2"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items.length()", is(2)))
                .andExpect(jsonPath("$.items[*].name", containsInAnyOrder("다중후보", "후순위후보")))
                .andExpect(jsonPath("$.items[0].name", is("다중후보")))
                .andExpect(jsonPath("$.items[0].matchedAlias", is("aa00")));
    }

    @Test
    void prefersTheStandardAliasAndUsesStableTieBreakers() throws Exception {
        Fish mullet = fish("숭어", "sungeo");
        Fish redMullet = fish("가숭어", "gasungeo");
        redMullet.addAlias("참숭어", FishAliasType.MARKET);
        redMullet.addAlias("감숭어", FishAliasType.MARKET);
        fishRepository.saveAllAndFlush(List.of(mullet, redMullet));

        mockMvc.perform(get("/api/v1/fish/suggestions")
                        .param("q", "숭어")
                        .param("limit", "8"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items.length()", is(2)))
                .andExpect(jsonPath("$.items[0].name", is("숭어")))
                .andExpect(jsonPath("$.items[0].matchedAlias", nullValue()))
                .andExpect(jsonPath("$.items[1].name", is("가숭어")))
                .andExpect(jsonPath("$.items[1].matchedAlias", nullValue()));
    }

    @Test
    void treatsLikeMetacharactersAsLiteralSuggestionText() throws Exception {
        Fish literal = fish("특수문자어", "literal-like");
        literal.addAlias("%_특가", FishAliasType.MARKET);
        Fish wildcardLookalike = fish("일반문자어", "ordinary-like");
        wildcardLookalike.addAlias("AB특가", FishAliasType.MARKET);
        fishRepository.saveAllAndFlush(List.of(literal, wildcardLookalike));

        mockMvc.perform(get("/api/v1/fish/suggestions")
                        .param("q", "%_")
                        .param("limit", "8"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items.length()", is(1)))
                .andExpect(jsonPath("$.items[0].name", is("특수문자어")))
                .andExpect(jsonPath("$.items[0].matchedAlias", is("%_특가")));
    }

    private Fish fish(String name, String slug) {
        Fish fish = new Fish();
        fish.setName(name);
        fish.setSlug(slug);
        fish.setDescription(name + " 설명");
        fish.setPriceLevel((short) 2);
        fish.addAlias(name, FishAliasType.STANDARD);
        return fish;
    }
}
