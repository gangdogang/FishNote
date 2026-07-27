package com.fishnote.image;

import java.util.Optional;
import java.util.List;
import java.util.UUID;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ReviewImageAssetRepository extends JpaRepository<ReviewImageAsset, UUID> {

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select asset from ReviewImageAsset asset where asset.id = :assetId")
    Optional<ReviewImageAsset> findByIdForUpdate(@Param("assetId") UUID assetId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select asset from ReviewImageAsset asset where asset.secureUrl = :secureUrl")
    Optional<ReviewImageAsset> findBySecureUrlForUpdate(@Param("secureUrl") String secureUrl);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select asset from ReviewImageAsset asset where asset.review.id = :reviewId")
    Optional<ReviewImageAsset> findByReviewIdForUpdate(@Param("reviewId") Long reviewId);

    @Query(value = """
            SELECT *
            FROM review_image_asset
            WHERE (status = 'PENDING' AND expires_at <= :now)
               OR (status = 'UPLOADING' AND expires_at <= :uploadingBefore)
               OR (status = 'DELETE_PENDING' AND deletion_claim_id IS NULL
                   AND (cleanup_available_at IS NULL OR cleanup_available_at <= :now))
               OR (status = 'ATTACHED' AND review_id IS NULL)
               OR (status = 'DELETE_PENDING' AND deletion_claim_id IS NOT NULL
                   AND updated_at <= :staleBefore)
            ORDER BY COALESCE(cleanup_available_at, expires_at) ASC, id ASC
            LIMIT :batchSize
            FOR UPDATE SKIP LOCKED
            """, nativeQuery = true)
    List<ReviewImageAsset> findCleanupCandidates(
            @Param("now") java.time.OffsetDateTime now,
            @Param("uploadingBefore") java.time.OffsetDateTime uploadingBefore,
            @Param("staleBefore") java.time.OffsetDateTime staleBefore,
            @Param("batchSize") int batchSize);
}
