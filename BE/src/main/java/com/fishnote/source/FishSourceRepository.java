package com.fishnote.source;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface FishSourceRepository extends JpaRepository<FishSource, Long> {

    @Query("select f.id as fishId, f.name as fishName from Fish f where f.id = :fishId")
    Optional<FishSourceTarget> findTargetByFishId(@Param("fishId") Long fishId);

    @Query("select f.id as fishId, f.name as fishName from Fish f where f.slug = :slug")
    Optional<FishSourceTarget> findTargetBySlug(@Param("slug") String slug);

    List<FishSource> findAllByFishId(Long fishId);
}
