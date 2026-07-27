package com.fishnote.fish;

import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.nullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.math.BigDecimal;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class FishMediaControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private FishRepository fishRepository;

    @Autowired
    private FishImageRepository fishImageRepository;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Test
    void h2SchemaMatchesTheSurrogateImageEntityContract() {
        List<String> columns = jdbcTemplate.queryForList(
                """
                SELECT column_name
                FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = 'fish_image'
                """,
                String.class);
        List<String> primaryKeyColumns = jdbcTemplate.queryForList(
                """
                SELECT key_column_usage.column_name
                FROM information_schema.table_constraints
                JOIN information_schema.key_column_usage
                  ON key_column_usage.constraint_catalog = table_constraints.constraint_catalog
                 AND key_column_usage.constraint_schema = table_constraints.constraint_schema
                 AND key_column_usage.constraint_name = table_constraints.constraint_name
                WHERE table_constraints.table_schema = 'public'
                  AND table_constraints.table_name = 'fish_image'
                  AND table_constraints.constraint_type = 'PRIMARY KEY'
                ORDER BY key_column_usage.ordinal_position
                """,
                String.class);
        List<String> constraints = jdbcTemplate.queryForList(
                """
                SELECT constraint_name
                FROM information_schema.table_constraints
                WHERE table_schema = 'public' AND table_name = 'fish_image'
                """,
                String.class);

        org.assertj.core.api.Assertions.assertThat(columns).contains(
                "id",
                "fish_id",
                "image_order",
                "role",
                "url",
                "public_id",
                "width",
                "height",
                "alt",
                "credit",
                "source_url",
                "license",
                "focal_x",
                "focal_y",
                "blur_data_url",
                "created_at",
                "updated_at");
        org.assertj.core.api.Assertions.assertThat(primaryKeyColumns).containsExactly("id");
        org.assertj.core.api.Assertions.assertThat(constraints)
                .contains("uq_fish_image_order", "uq_fish_image_public_id");
    }

    @Test
    void listDetailAndSimilarResponsesExposeMediaMetadataAdditively() throws Exception {
        Fish similar = fish("D3 미디어 참돔", "media-chamdom", "https://legacy.example/chamdom.jpg");
        FishImage similarPrimary = similar.addMedia(
                FishImageRole.PRIMARY,
                "https://cdn.example/chamdom-primary.jpg",
                "fish/chamdom/primary",
                1200,
                800,
                "바다에서 헤엄치는 참돔",
                "사진가 B",
                "https://source.example/chamdom",
                "CC BY 4.0",
                new BigDecimal("0.5000"),
                new BigDecimal("0.5000"),
                null);
        fishRepository.saveAndFlush(similar);

        Fish fish = fish("D3 미디어 광어", "media-gwangeo", "https://legacy.example/gwangeo.jpg");
        FishImage primary = fish.addMedia(
                FishImageRole.PRIMARY,
                "https://cdn.example/gwangeo-primary.jpg",
                "fish/gwangeo/primary",
                1600,
                1200,
                "접시에 담긴 광어회",
                "사진가 A",
                "https://source.example/gwangeo-primary",
                "공공누리 제1유형",
                new BigDecimal("0.2500"),
                new BigDecimal("0.7500"),
                "data:image/png;base64,cHJpbWFyeQ==");
        FishImage gallery = fish.addMedia(
                FishImageRole.GALLERY,
                "https://cdn.example/gwangeo-gallery.jpg",
                "fish/gwangeo/gallery-1",
                1400,
                1050,
                "광어회 상세 사진",
                "사진가 A",
                "https://source.example/gwangeo-gallery",
                "공공누리 제1유형",
                null,
                null,
                "data:image/jpeg;base64,Z2FsbGVyeQ==");
        fish.getSimilarFishes().add(similar);
        fishRepository.saveAndFlush(fish);

        mockMvc.perform(get("/api/v1/fish")
                        .param("search", "D3 미디어 광어")
                        .param("sort", "name"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()", is(1)))
                .andExpect(jsonPath("$[0].media.id", is(primary.getId().toString())))
                .andExpect(jsonPath("$[0].media.url", is(primary.getUrl())))
                .andExpect(jsonPath("$[0].media.width", is(1600)))
                .andExpect(jsonPath("$[0].media.height", is(1200)))
                .andExpect(jsonPath("$[0].media.alt", is("접시에 담긴 광어회")))
                .andExpect(jsonPath("$[0].media.role", is("PRIMARY")))
                .andExpect(jsonPath("$[0].media.credit", is("사진가 A")))
                .andExpect(jsonPath("$[0].media.sourceUrl", is("https://source.example/gwangeo-primary")))
                .andExpect(jsonPath("$[0].media.license", is("공공누리 제1유형")))
                .andExpect(jsonPath("$[0].media.focalPoint.x", is(0.25)))
                .andExpect(jsonPath("$[0].media.focalPoint.y", is(0.75)))
                .andExpect(jsonPath("$[0].media.blurDataUrl", is("data:image/png;base64,cHJpbWFyeQ==")))
                .andExpect(jsonPath("$[0].imageUrl", is(fish.getImageUrl())));

        mockMvc.perform(get("/api/v1/fish/{identifier}", fish.getSlug()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.media.id", is(primary.getId().toString())))
                .andExpect(jsonPath("$.media.alt", is("접시에 담긴 광어회")))
                .andExpect(jsonPath("$.media.credit", is("사진가 A")))
                .andExpect(jsonPath("$.media.sourceUrl", is("https://source.example/gwangeo-primary")))
                .andExpect(jsonPath("$.media.license", is("공공누리 제1유형")))
                .andExpect(jsonPath("$.media.focalPoint.x", is(0.25)))
                .andExpect(jsonPath("$.media.focalPoint.y", is(0.75)))
                .andExpect(jsonPath("$.media.blurDataUrl", is("data:image/png;base64,cHJpbWFyeQ==")))
                .andExpect(jsonPath("$.images", contains(primary.getUrl(), gallery.getUrl())))
                .andExpect(jsonPath("$.galleryMedia.length()", is(1)))
                .andExpect(jsonPath("$.galleryMedia[0].id", is(gallery.getId().toString())))
                .andExpect(jsonPath("$.galleryMedia[0].role", is("GALLERY")))
                .andExpect(jsonPath("$.galleryMedia[0].width", is(1400)))
                .andExpect(jsonPath("$.galleryMedia[0].height", is(1050)))
                .andExpect(jsonPath("$.galleryMedia[0].alt", is("광어회 상세 사진")))
                .andExpect(jsonPath("$.galleryMedia[0].credit", is("사진가 A")))
                .andExpect(jsonPath("$.galleryMedia[0].sourceUrl", is("https://source.example/gwangeo-gallery")))
                .andExpect(jsonPath("$.galleryMedia[0].license", is("공공누리 제1유형")))
                .andExpect(jsonPath("$.galleryMedia[0].focalPoint", nullValue()))
                .andExpect(jsonPath("$.galleryMedia[0].blurDataUrl", is("data:image/jpeg;base64,Z2FsbGVyeQ==")))
                .andExpect(jsonPath("$.similarFishes[0].media.id", is(similarPrimary.getId().toString())))
                .andExpect(jsonPath("$.similarFishes[0].media.url", is(similarPrimary.getUrl())))
                .andExpect(jsonPath("$.similarFishes[0].media.width", is(1200)))
                .andExpect(jsonPath("$.similarFishes[0].media.height", is(800)))
                .andExpect(jsonPath("$.similarFishes[0].media.credit", is("사진가 B")))
                .andExpect(jsonPath("$.similarFishes[0].media.license", is("CC BY 4.0")))
                .andExpect(jsonPath("$.similarFishes[0].imageUrl", is(similar.getImageUrl())));
    }

    @Test
    void incompleteLegacyRowsStayOnImagesAndImageUrlFallbackWithoutInventedDimensions() throws Exception {
        Fish fish = fish("레거시광어", "legacy-media-gwangeo", "https://legacy.example/primary.jpg");
        fish.getImages().addAll(List.of(
                "https://legacy.example/gallery-1.jpg",
                "https://legacy.example/gallery-2.jpg"));
        fishRepository.saveAndFlush(fish);

        mockMvc.perform(get("/api/v1/fish/{identifier}", fish.getId()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.media", nullValue()))
                .andExpect(jsonPath("$.galleryMedia.length()", is(0)))
                .andExpect(jsonPath("$.imageUrl", is("https://legacy.example/primary.jpg")))
                .andExpect(jsonPath("$.images", contains(
                        "https://legacy.example/gallery-1.jpg",
                        "https://legacy.example/gallery-2.jpg")));
    }

    @Test
    void legacyUrlHelperPersistsThroughTheFishImageRepositoryInStoredOrder() {
        Fish fish = fish("도우미광어", "helper-media-gwangeo", null);
        fish.getImages().addAll(List.of("첫 이미지", "둘째 이미지", "셋째 이미지"));
        fish.getImages().set(1, "수정한 둘째 이미지");
        fish.getImages().remove(0);
        fishRepository.saveAndFlush(fish);

        List<FishImage> stored = fishImageRepository.findAllByFishIdOrderByImageOrder(fish.getId());

        org.assertj.core.api.Assertions.assertThat(stored)
                .extracting(FishImage::getUrl)
                .containsExactly("수정한 둘째 이미지", "셋째 이미지");
        org.assertj.core.api.Assertions.assertThat(stored)
                .extracting(FishImage::getImageOrder)
                .containsExactly(0, 1);
        org.assertj.core.api.Assertions.assertThat(stored)
                .extracting(FishImage::getRole)
                .containsExactly(FishImageRole.PRIMARY, FishImageRole.GALLERY);
    }

    private Fish fish(String name, String slug, String imageUrl) {
        Fish fish = new Fish();
        fish.setName(name);
        fish.setSlug(slug);
        fish.setCategory(FishCategory.FISH);
        fish.setImageUrl(imageUrl);
        fish.setDescription(name + " 설명");
        fish.setFeatured(false);
        return fish;
    }
}
