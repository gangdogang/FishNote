package com.fishnote.review;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ReviewRepository extends JpaRepository<Review, Long> {

    Page<Review> findByFishId(Long fishId, Pageable pageable);

    // Page와 달리 count 쿼리를 추가로 날리지 않음 — 총 개수는 집계 쿼리에서 얻는다
    List<Review> findAllByFishId(Long fishId, Pageable pageable);

    long countByFishId(Long fishId);

    @Query("select avg(r.rating) from Review r where r.fish.id = :fishId and r.rating is not null")
    Optional<Double> averageRatingByFishId(@Param("fishId") Long fishId);

    @Query("""
            select r.rating as rating, count(r) as count
            from Review r
            where r.fish.id = :fishId and r.rating is not null
            group by r.rating
            """)
    List<RatingCount> countByRatingForFishId(@Param("fishId") Long fishId);

    @Query("""
            select r.fish.id as fishId,
                   avg(r.rating) as avgRating,
                   count(r) as reviewCount,
                   count(r.rating) as ratingCount
            from Review r
            where r.fish.id in :fishIds
            group by r.fish.id
            """)
    List<FishRatingStat> findRatingStatsByFishIds(@Param("fishIds") Collection<Long> fishIds);

    @Modifying(clearAutomatically = true)
    @Query("update Review r set r.user = null where r.user.id = :userId")
    int anonymizeByUserId(@Param("userId") Long userId);
}
