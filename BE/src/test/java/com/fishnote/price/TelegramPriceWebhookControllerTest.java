package com.fishnote.price;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.is;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fishnote.fish.Fish;
import com.fishnote.fish.FishRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@TestPropertySource(properties = "app.telegram.webhook-secret=test-secret")
class TelegramPriceWebhookControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private FishRepository fishRepository;

    @Autowired
    private ShopPriceObservationRepository shopPriceObservationRepository;

    @BeforeEach
    void setUp() {
        shopPriceObservationRepository.deleteAll();
        fishRepository.deleteAll();
        fishRepository.save(fish("광어"));
        fishRepository.save(fish("연어"));
    }

    @Test
    void importsTelegramPriceTextAndSkipsDuplicates() throws Exception {
        String payload =
                """
                {
                  "update_id": 1,
                  "message": {
                    "message_id": 10,
                    "chat": {"id": 1234},
                    "date": 1783900800,
                    "text": "2026년07월13일 윤호수산 시세단가\\n제주광어2.4~2.5kㅡ32000\\n###노르웨이###\\n연어1k20000(6~7k사이)10시전에주문주세요\\n연어손질비용kg당2000"
                  }
                }
                """;

        mockMvc.perform(post("/api/v1/integrations/telegram/price-updates")
                        .header("X-Telegram-Bot-Api-Secret-Token", "test-secret")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payload))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.parsedCount", is(2)))
                .andExpect(jsonPath("$.savedCount", is(2)))
                .andExpect(jsonPath("$.sourceNames", contains("윤호수산")));

        mockMvc.perform(post("/api/v1/integrations/telegram/price-updates")
                        .header("X-Telegram-Bot-Api-Secret-Token", "test-secret")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payload))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.parsedCount", is(2)))
                .andExpect(jsonPath("$.savedCount", is(0)));

        assertThat(shopPriceObservationRepository.findAll())
                .extracting(ShopPriceObservation::getPriceMinKrw)
                .containsExactlyInAnyOrder(32000, 20000);
    }

    @Test
    void rejectsInvalidTelegramSecret() throws Exception {
        mockMvc.perform(post("/api/v1/integrations/telegram/price-updates")
                        .header("X-Telegram-Bot-Api-Secret-Token", "wrong")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"message\":{\"text\":\"제주광어2.4kㅡ32000\"}}"))
                .andExpect(status().isUnauthorized());
    }

    private Fish fish(String name) {
        Fish fish = new Fish();
        fish.setName(name);
        fish.setNameEn(name);
        fish.setDescription(name + " 설명");
        fish.setPriceLevel((short) 2);
        return fish;
    }
}
