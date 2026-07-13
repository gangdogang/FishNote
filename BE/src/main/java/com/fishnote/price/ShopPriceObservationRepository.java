package com.fishnote.price;

import java.time.OffsetDateTime;
import java.util.List;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ShopPriceObservationRepository extends JpaRepository<ShopPriceObservation, Long> {

    List<ShopPriceObservation> findByFish_IdAndObservedAtGreaterThanEqualOrderByObservedAtDesc(
            Long fishId, OffsetDateTime observedAfter, Pageable pageable);

    List<ShopPriceObservation> findByFish_IdAndObservedAtGreaterThanEqualOrderByObservedAtAsc(
            Long fishId, OffsetDateTime observedAfter);

    long countByFish_IdAndObservedAtGreaterThanEqual(Long fishId, OffsetDateTime observedAfter);

    @Query(
            """
            select count(o) > 0
            from ShopPriceObservation o
            where o.observedAt = :observedAt
              and o.sourceType = :sourceType
              and coalesce(o.sourceName, '') = coalesce(:sourceName, '')
              and o.reportedName = :reportedName
              and o.priceMinKrw = :priceMinKrw
              and o.priceMaxKrw = :priceMaxKrw
              and o.rawText = :rawText
            """)
    boolean existsDuplicate(
            @Param("observedAt") OffsetDateTime observedAt,
            @Param("sourceType") String sourceType,
            @Param("sourceName") String sourceName,
            @Param("reportedName") String reportedName,
            @Param("priceMinKrw") int priceMinKrw,
            @Param("priceMaxKrw") int priceMaxKrw,
            @Param("rawText") String rawText);
}
