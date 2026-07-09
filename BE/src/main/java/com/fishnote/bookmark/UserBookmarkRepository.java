package com.fishnote.bookmark;

import java.util.Collection;
import java.util.List;
import java.util.Set;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface UserBookmarkRepository extends JpaRepository<UserBookmark, UserBookmarkId> {

    @Query("""
            select b.id.fishId
            from UserBookmark b
            where b.id.userId = :userId
            order by b.createdAt asc, b.id.fishId asc
            """)
    List<Long> findFishIdsByUserIdOrderByCreatedAt(@Param("userId") Long userId);

    @Query("""
            select b.id.fishId
            from UserBookmark b
            where b.id.userId = :userId and b.id.fishId in :fishIds
            """)
    Set<Long> findBookmarkedFishIds(@Param("userId") Long userId, @Param("fishIds") Collection<Long> fishIds);

    @Modifying
    @Query("""
            delete from UserBookmark b
            where b.id.userId = :userId and b.id.fishId = :fishId
            """)
    int deleteByUserIdAndFishId(@Param("userId") Long userId, @Param("fishId") Long fishId);
}
