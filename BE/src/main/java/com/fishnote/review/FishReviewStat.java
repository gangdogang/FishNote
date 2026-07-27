package com.fishnote.review;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.OffsetDateTime;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "fish_review_stat")
@Getter
@NoArgsConstructor
public class FishReviewStat implements FishRatingStat {

    @Id
    @Column(name = "fish_id")
    private Long fishId;

    @Column(name = "review_count", nullable = false)
    private long reviewCount;

    @Column(name = "rating_count", nullable = false)
    private long ratingCount;

    @Column(name = "rating_sum", nullable = false)
    private long ratingSum;

    @Column(name = "rating_1_count", nullable = false)
    private long rating1Count;

    @Column(name = "rating_2_count", nullable = false)
    private long rating2Count;

    @Column(name = "rating_3_count", nullable = false)
    private long rating3Count;

    @Column(name = "rating_4_count", nullable = false)
    private long rating4Count;

    @Column(name = "rating_5_count", nullable = false)
    private long rating5Count;

    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;

    @Override
    public Double getAvgRating() {
        return ratingCount == 0 ? null : (double) ratingSum / ratingCount;
    }
}
