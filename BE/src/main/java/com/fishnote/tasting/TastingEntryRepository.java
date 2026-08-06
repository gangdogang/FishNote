package com.fishnote.tasting;

import java.time.LocalDate;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface TastingEntryRepository extends JpaRepository<TastingEntry, Long> {

    @EntityGraph(attributePaths = "fish")
    Page<TastingEntry> findAllByUserId(Long userId, Pageable pageable);

    @EntityGraph(attributePaths = "fish")
    Optional<TastingEntry> findByIdAndUserId(Long id, Long userId);

    @Query("select count(distinct entry.fish.id) from TastingEntry entry where entry.user.id = :userId")
    long countDistinctFishByUserId(@Param("userId") Long userId);

    long countByUserIdAndTastedOnBetween(Long userId, LocalDate start, LocalDate end);
}
