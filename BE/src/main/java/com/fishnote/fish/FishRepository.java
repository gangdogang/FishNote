package com.fishnote.fish;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface FishRepository extends JpaRepository<Fish, Long>, JpaSpecificationExecutor<Fish> {

    // v1 호환용 scalar lookup. v1/v2 HTTP 상세는 FishDetailQueryRepository의 3단계 projection을 사용한다.
    @Query("select f from Fish f where f.id = :id")
    Optional<Fish> findDetailById(@Param("id") Long id);

    @Query("select f from Fish f where f.slug = :slug")
    Optional<Fish> findDetailBySlug(@Param("slug") String slug);

    Optional<Fish> findByName(String name);

    List<Fish> findAllByOrderByNameAsc();

    boolean existsByNameAndIdNot(String name, Long id);

    boolean existsBySlugAndIdNot(String slug, Long id);
}
