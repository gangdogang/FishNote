package com.fishnote.fish;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.test.context.ActiveProfiles;

@DataJpaTest
@ActiveProfiles("test")
class FishAliasRepositoryTest {

    @Autowired
    private FishRepository fishRepository;

    @Autowired
    private FishAliasRepository fishAliasRepository;

    @Test
    void persistsOrphansAndDeletesAliasesThroughFishAggregate() {
        Fish fish = fish("alias-lifecycle");
        FishAlias alias = fish.addAlias("넙치", FishAliasType.MARKET);
        fishRepository.saveAndFlush(fish);

        assertThat(alias.getFish()).isSameAs(fish);
        assertThat(fishAliasRepository.count()).isOne();

        fish.removeAlias(alias);
        fishRepository.saveAndFlush(fish);

        assertThat(alias.getFish()).isNull();
        assertThat(fishAliasRepository.count()).isZero();

        fish.addAlias("광어", FishAliasType.STANDARD);
        fishRepository.saveAndFlush(fish);
        fishRepository.delete(fish);
        fishRepository.flush();

        assertThat(fishAliasRepository.count()).isZero();
    }

    private Fish fish(String slug) {
        Fish fish = new Fish();
        fish.setName("광어");
        fish.setSlug(slug);
        fish.setDescription("광어 설명");
        fish.setPriceLevel((short) 2);
        return fish;
    }
}
