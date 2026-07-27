package com.fishnote.review;

import java.util.Collection;
import java.util.List;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
public class FishRatingStatReader {

    private final ReviewRepository reviewRepository;
    private final FishReviewStatRepository statRepository;
    private final boolean readModelEnabled;

    public FishRatingStatReader(
            ReviewRepository reviewRepository,
            FishReviewStatRepository statRepository,
            @Value("${app.read-model.review-stat.enabled:true}") boolean readModelEnabled) {
        this.reviewRepository = reviewRepository;
        this.statRepository = statRepository;
        this.readModelEnabled = readModelEnabled;
    }

    public List<? extends FishRatingStat> findByFishIds(Collection<Long> fishIds) {
        if (fishIds.isEmpty()) {
            return List.of();
        }
        if (readModelEnabled) {
            return statRepository.findAllByFishIdIn(fishIds);
        }
        return reviewRepository.findRatingStatsByFishIds(fishIds);
    }

    public boolean isReadModelEnabled() {
        return readModelEnabled;
    }
}
