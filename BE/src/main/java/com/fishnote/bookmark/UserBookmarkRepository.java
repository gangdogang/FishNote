package com.fishnote.bookmark;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface UserBookmarkRepository extends JpaRepository<UserBookmark, UserBookmarkId> {

    @Modifying
    @Query("""
            delete from UserBookmark b
            where b.id.userId = :userId and b.id.fishId = :fishId
            """)
    int deleteByUserIdAndFishId(@Param("userId") Long userId, @Param("fishId") Long fishId);

    @Modifying
    @Query("delete from UserBookmark b where b.id.userId = :userId")
    int deleteAllByUserId(@Param("userId") Long userId);
}
