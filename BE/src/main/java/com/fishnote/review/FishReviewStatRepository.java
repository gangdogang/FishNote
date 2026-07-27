package com.fishnote.review;

import java.util.Collection;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface FishReviewStatRepository extends JpaRepository<FishReviewStat, Long> {

    List<FishReviewStat> findAllByFishIdIn(Collection<Long> fishIds);
}
