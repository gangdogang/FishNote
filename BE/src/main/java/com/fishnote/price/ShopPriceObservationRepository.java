package com.fishnote.price;

import java.time.OffsetDateTime;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ShopPriceObservationRepository extends JpaRepository<ShopPriceObservation, Long> {

    @Query(
            """
            select o.observedAt as observedAt,
                   o.priceMinKrw as priceMinKrw,
                   o.priceMaxKrw as priceMaxKrw,
                   o.unit as unit,
                   o.origin as origin,
                   o.sizeGrade as sizeGrade,
                   o.sourceName as sourceName,
                   o.condition as condition
            from ShopPriceObservation o
            where o.fish.id = :fishId
              and o.observedAt >= :observedAfter
            order by o.observedAt asc
            """)
    List<PriceRow> findPriceRows(
            @Param("fishId") Long fishId,
            @Param("observedAfter") OffsetDateTime observedAfter);
}
