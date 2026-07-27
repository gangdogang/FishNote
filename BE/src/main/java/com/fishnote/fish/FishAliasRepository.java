package com.fishnote.fish;

import com.fishnote.fish.dto.FishSuggestionCandidate;
import java.util.List;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface FishAliasRepository extends JpaRepository<FishAlias, Long> {

    @EntityGraph(attributePaths = "fish")
    @Query("select a from FishAlias a")
    List<FishAlias> findAllWithFish();

    @Query(value = """
            SELECT ranked.fish_id AS "id",
                   ranked.slug AS "slug",
                   ranked.name AS "name",
                   ranked.matched_alias AS "matchedAlias",
                   ranked.thumbnail AS "thumbnail"
            FROM (
                SELECT f.id AS fish_id,
                       f.slug AS slug,
                       f.name AS name,
                       a.alias AS matched_alias,
                       f.image_url AS thumbnail,
                       CASE
                           WHEN lower(a.alias) = :query THEN 0
                           WHEN lower(a.alias) LIKE :prefixPattern ESCAPE '\\' THEN 1
                           ELSE 2
                       END AS match_rank,
                       CASE WHEN a.alias_type = 'STANDARD' THEN 0 ELSE 1 END AS alias_rank,
                       length(a.alias) AS alias_length,
                       row_number() OVER (
                           PARTITION BY f.id
                           ORDER BY
                               CASE
                                   WHEN lower(a.alias) = :query THEN 0
                                   WHEN lower(a.alias) LIKE :prefixPattern ESCAPE '\\' THEN 1
                                   ELSE 2
                               END,
                               CASE WHEN a.alias_type = 'STANDARD' THEN 0 ELSE 1 END,
                               length(a.alias),
                               lower(a.alias),
                               a.id
                       ) AS fish_match_rank
                FROM fish_alias a
                JOIN fish f ON f.id = a.fish_id
                WHERE lower(a.alias) LIKE :pattern ESCAPE '\\'
            ) ranked
            WHERE ranked.fish_match_rank = 1
            ORDER BY ranked.match_rank,
                     ranked.alias_rank,
                     ranked.alias_length,
                     ranked.name,
                     lower(ranked.matched_alias),
                     ranked.fish_id
            """, nativeQuery = true)
    List<FishSuggestionCandidate> findSuggestionCandidates(
            @Param("query") String query,
            @Param("pattern") String pattern,
            @Param("prefixPattern") String prefixPattern,
            Pageable pageable);
}
