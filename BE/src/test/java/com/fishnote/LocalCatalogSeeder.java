package com.fishnote;

import com.fishnote.fish.Fish;
import com.fishnote.fish.FishRepository;
import java.util.List;
import java.util.Set;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/** Small opt-in catalog used only by bootTestRun for local screen checks. */
@Component
@ConditionalOnProperty(prefix = "app.dev", name = "seed", havingValue = "true")
public class LocalCatalogSeeder implements ApplicationRunner {

    private final FishRepository fishRepository;

    public LocalCatalogSeeder(FishRepository fishRepository) {
        this.fishRepository = fishRepository;
    }

    @Override
    public void run(ApplicationArguments args) {
        if (fishRepository.count() > 0) {
            return;
        }
        fishRepository.saveAll(List.of(
                fish("광어", "gwang-eo", "담백하고 쫄깃한 입문용 흰살회", 1, true,
                        Set.of("담백", "쫄깃"), Set.of(1, 2, 8, 12)),
                fish("농어", "nong-eo", "여름에 맛이 오르는 산뜻한 흰살회", 2, false,
                        Set.of("담백", "감칠맛"), Set.of(6, 7, 8)),
                fish("연어", "yeon-eo", "부드럽고 고소해 누구나 편하게 즐기는 회", 2, true,
                        Set.of("고소", "부드러운"), Set.of(1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12)),
                fish("돌돔", "dol-dom", "단단한 식감과 고소한 뒷맛의 고급 횟감", 3, false,
                        Set.of("쫄깃", "고소", "고급"), Set.of(6, 7, 8))));
    }

    private Fish fish(
            String name,
            String slug,
            String description,
            int priceLevel,
            boolean featured,
            Set<String> tasteTags,
            Set<Integer> seasonMonths) {
        Fish fish = new Fish();
        fish.setName(name);
        fish.setSlug(slug);
        fish.setDescription(description);
        fish.setTasteDesc(description);
        fish.setPriceLevel((short) priceLevel);
        fish.setFeatured(featured);
        fish.getTasteTags().addAll(tasteTags);
        seasonMonths.stream().map(Integer::shortValue).forEach(fish.getSeasonMonths()::add);
        return fish;
    }
}
