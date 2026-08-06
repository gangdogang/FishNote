package com.fishnote.image;

import com.fishnote.review.Review;
import com.fishnote.tasting.TastingEntry;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OneToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import java.time.OffsetDateTime;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.OnDelete;
import org.hibernate.annotations.OnDeleteAction;
import org.hibernate.annotations.UpdateTimestamp;

@Entity
@Table(
        name = "review_image_asset",
        indexes = @Index(
                name = "idx_review_image_asset_cleanup",
                columnList = "status, cleanup_available_at, id"),
        uniqueConstraints = {
            @UniqueConstraint(name = "uq_review_image_asset_public_id", columnNames = "public_id"),
            @UniqueConstraint(name = "uq_review_image_asset_review", columnNames = "review_id"),
            @UniqueConstraint(name = "uq_review_image_asset_tasting_entry", columnNames = "tasting_entry_id")
        })
@Getter
@NoArgsConstructor
public class ReviewImageAsset {

    @Id
    @Column(nullable = false, updatable = false)
    private UUID id;

    @Column(name = "public_id", nullable = false, updatable = false, length = 255)
    private String publicId;

    @Column(name = "secure_url", columnDefinition = "text")
    private String secureUrl;

    @Column(name = "uploader_key", nullable = false, updatable = false, length = 67)
    private String uploaderKey;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private ReviewImageAssetStatus status;

    @Column(name = "expires_at", nullable = false)
    private OffsetDateTime expiresAt;

    @Column(name = "upload_completed_at")
    private OffsetDateTime uploadCompletedAt;

    @Column(name = "attached_at")
    private OffsetDateTime attachedAt;

    @Column(name = "deletion_claim_id")
    private UUID deletionClaimId;

    @Column(name = "cleanup_available_at")
    private OffsetDateTime cleanupAvailableAt;

    @Column(name = "cleanup_attempts", nullable = false)
    private int cleanupAttempts;

    @Enumerated(EnumType.STRING)
    @Column(name = "cleanup_origin_status", length = 20)
    private ReviewImageAssetStatus cleanupOriginStatus;

    @Column(name = "cleanup_not_found_safe_at")
    private OffsetDateTime cleanupNotFoundSafeAt;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "review_id", unique = true)
    @OnDelete(action = OnDeleteAction.SET_NULL)
    private Review review;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "tasting_entry_id", unique = true)
    @OnDelete(action = OnDeleteAction.SET_NULL)
    private TastingEntry tastingEntry;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;

    public ReviewImageAsset(
            UUID id,
            String publicId,
            String uploaderKey,
            OffsetDateTime expiresAt) {
        this.id = id;
        this.publicId = publicId;
        this.uploaderKey = uploaderKey;
        this.expiresAt = expiresAt;
        this.status = ReviewImageAssetStatus.UPLOADING;
    }

    void completeUpload(
            String secureUrl,
            OffsetDateTime completedAt,
            OffsetDateTime pendingExpiresAt) {
        if (status != ReviewImageAssetStatus.UPLOADING) {
            throw new IllegalStateException("업로드 중인 이미지 자산만 완료할 수 있습니다.");
        }
        if (completedAt == null
                || pendingExpiresAt == null
                || !pendingExpiresAt.isAfter(completedAt)) {
            throw new IllegalArgumentException("이미지 자산 PENDING 만료시각이 올바르지 않습니다.");
        }
        this.secureUrl = secureUrl;
        this.uploadCompletedAt = completedAt;
        this.expiresAt = pendingExpiresAt;
        this.deletionClaimId = null;
        this.cleanupAvailableAt = null;
        this.cleanupAttempts = 0;
        this.cleanupOriginStatus = null;
        this.cleanupNotFoundSafeAt = null;
        this.status = ReviewImageAssetStatus.PENDING;
    }

    void attach(Review review, OffsetDateTime attachedAt) {
        if (status != ReviewImageAssetStatus.PENDING) {
            throw new IllegalStateException("대기 중인 이미지 자산만 후기에 첨부할 수 있습니다.");
        }
        this.review = review;
        this.tastingEntry = null;
        this.attachedAt = attachedAt;
        this.deletionClaimId = null;
        this.cleanupAvailableAt = null;
        this.cleanupAttempts = 0;
        this.cleanupOriginStatus = null;
        this.cleanupNotFoundSafeAt = null;
        this.status = ReviewImageAssetStatus.ATTACHED;
    }

    void attach(TastingEntry tastingEntry, OffsetDateTime attachedAt) {
        if (status != ReviewImageAssetStatus.PENDING) {
            throw new IllegalStateException("대기 중인 이미지 자산만 먹어본 기록에 첨부할 수 있습니다.");
        }
        this.review = null;
        this.tastingEntry = tastingEntry;
        this.attachedAt = attachedAt;
        this.deletionClaimId = null;
        this.cleanupAvailableAt = null;
        this.cleanupAttempts = 0;
        this.cleanupOriginStatus = null;
        this.cleanupNotFoundSafeAt = null;
        this.status = ReviewImageAssetStatus.ATTACHED;
    }

    void markDeletePending(
            OffsetDateTime availableAt,
            OffsetDateTime uploadingNotFoundSafeAt) {
        if (availableAt == null) {
            throw new IllegalArgumentException("이미지 자산 정리 가능 시각이 필요합니다.");
        }
        if (status != ReviewImageAssetStatus.UPLOADING
                && status != ReviewImageAssetStatus.PENDING
                && status != ReviewImageAssetStatus.DELETE_PENDING) {
            throw new IllegalStateException("첨부 또는 삭제 중인 이미지 자산은 삭제 대기로 바꿀 수 없습니다.");
        }
        ReviewImageAssetStatus previousStatus = status;
        this.review = null;
        this.tastingEntry = null;
        this.deletionClaimId = null;
        this.cleanupAvailableAt = availableAt;
        if (previousStatus != ReviewImageAssetStatus.DELETE_PENDING) {
            this.cleanupAttempts = 0;
            this.cleanupOriginStatus = previousStatus;
            this.cleanupNotFoundSafeAt = previousStatus == ReviewImageAssetStatus.UPLOADING
                    ? requireUploadingNotFoundSafeAt(uploadingNotFoundSafeAt)
                    : null;
        }
        this.status = ReviewImageAssetStatus.DELETE_PENDING;
    }

    void markAttachedReviewDeleted(OffsetDateTime availableAt) {
        if (availableAt == null) {
            throw new IllegalArgumentException("이미지 자산 정리 가능 시각이 필요합니다.");
        }
        if (status != ReviewImageAssetStatus.ATTACHED) {
            throw new IllegalStateException("후기에 첨부된 이미지 자산만 분리할 수 있습니다.");
        }
        this.review = null;
        this.deletionClaimId = null;
        this.cleanupAvailableAt = availableAt;
        this.cleanupAttempts = 0;
        this.cleanupOriginStatus = ReviewImageAssetStatus.ATTACHED;
        this.cleanupNotFoundSafeAt = null;
        this.status = ReviewImageAssetStatus.DELETE_PENDING;
    }

    void markAttachedTastingDeleted(OffsetDateTime availableAt) {
        if (availableAt == null) {
            throw new IllegalArgumentException("이미지 자산 정리 가능 시각이 필요합니다.");
        }
        if (status != ReviewImageAssetStatus.ATTACHED || tastingEntry == null) {
            throw new IllegalStateException("먹어본 기록에 첨부된 이미지 자산만 분리할 수 있습니다.");
        }
        this.tastingEntry = null;
        this.deletionClaimId = null;
        this.cleanupAvailableAt = availableAt;
        this.cleanupAttempts = 0;
        this.cleanupOriginStatus = ReviewImageAssetStatus.ATTACHED;
        this.cleanupNotFoundSafeAt = null;
        this.status = ReviewImageAssetStatus.DELETE_PENDING;
    }

    void claimDeletion(
            UUID claimId,
            OffsetDateTime claimedAt,
            OffsetDateTime uploadingNotFoundSafeAt) {
        if (claimId == null || claimedAt == null) {
            throw new IllegalArgumentException("이미지 자산 삭제 claim 정보가 필요합니다.");
        }
        if ((review != null || tastingEntry != null)
                || (status != ReviewImageAssetStatus.UPLOADING
                        && status != ReviewImageAssetStatus.PENDING
                        && status != ReviewImageAssetStatus.DELETE_PENDING)) {
            throw new IllegalStateException("분리된 이미지 자산만 삭제할 수 있습니다.");
        }
        ReviewImageAssetStatus previousStatus = status;
        if (cleanupOriginStatus == null) {
            // V8 workers can still write a cleanup-metadata-free DELETE_PENDING row during
            // a rolling deploy. Treat that unknown origin conservatively as an uncertain upload.
            cleanupOriginStatus = previousStatus == ReviewImageAssetStatus.DELETE_PENDING
                    ? ReviewImageAssetStatus.UPLOADING
                    : previousStatus;
            cleanupNotFoundSafeAt = cleanupOriginStatus == ReviewImageAssetStatus.UPLOADING
                    ? requireUploadingNotFoundSafeAt(uploadingNotFoundSafeAt)
                    : null;
        }
        this.status = ReviewImageAssetStatus.DELETE_PENDING;
        this.deletionClaimId = claimId;
        this.cleanupAvailableAt = claimedAt;
        if (cleanupAttempts < Integer.MAX_VALUE) {
            this.cleanupAttempts++;
        }
    }

    boolean isDeletionClaimedBy(UUID claimId) {
        return status == ReviewImageAssetStatus.DELETE_PENDING
                && deletionClaimId != null
                && deletionClaimId.equals(claimId);
    }

    void releaseDeletion(UUID claimId, OffsetDateTime retryAt) {
        if (!isDeletionClaimedBy(claimId)) {
            throw new IllegalStateException("현재 이미지 자산 삭제 claim과 일치하지 않습니다.");
        }
        if (retryAt == null) {
            throw new IllegalArgumentException("이미지 자산 정리 재시도 시각이 필요합니다.");
        }
        this.status = ReviewImageAssetStatus.DELETE_PENDING;
        this.deletionClaimId = null;
        this.cleanupAvailableAt = retryAt;
    }

    private OffsetDateTime requireUploadingNotFoundSafeAt(OffsetDateTime value) {
        if (value == null) {
            throw new IllegalArgumentException("업로드 중 이미지 자산의 not-found 안전시각이 필요합니다.");
        }
        return value;
    }
}
