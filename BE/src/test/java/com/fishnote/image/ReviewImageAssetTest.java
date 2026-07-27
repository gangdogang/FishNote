package com.fishnote.image;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.fishnote.review.Review;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class ReviewImageAssetTest {

    private static final OffsetDateTime NOW =
            OffsetDateTime.of(2026, 7, 22, 12, 0, 0, 0, ZoneOffset.UTC);

    @Test
    void followsUploadingPendingAndAttachedLifecycle() {
        ReviewImageAsset asset = newAsset();
        assertThat(asset.getStatus()).isEqualTo(ReviewImageAssetStatus.UPLOADING);
        assertThat(asset.getSecureUrl()).isNull();

        asset.completeUpload(
                "https://res.cloudinary.com/demo/image/upload/review.jpg",
                NOW,
                NOW.plusHours(1));
        assertThat(asset.getStatus()).isEqualTo(ReviewImageAssetStatus.PENDING);
        assertThat(asset.getUploadCompletedAt()).isEqualTo(NOW);

        Review review = new Review();
        asset.attach(review, NOW.plusMinutes(1));
        assertThat(asset.getStatus()).isEqualTo(ReviewImageAssetStatus.ATTACHED);
        assertThat(asset.getReview()).isSameAs(review);
        assertThat(asset.getAttachedAt()).isEqualTo(NOW.plusMinutes(1));
    }

    @Test
    void invalidTransitionsAreRejectedAndUnattachedAssetsCanQueueDeletion() {
        ReviewImageAsset uploading = newAsset();
        assertThatThrownBy(() -> uploading.attach(new Review(), NOW))
                .isInstanceOf(IllegalStateException.class);

        uploading.markDeletePending(NOW, NOW.plusHours(24));
        assertThat(uploading.getStatus()).isEqualTo(ReviewImageAssetStatus.DELETE_PENDING);
        assertThatThrownBy(() -> uploading.completeUpload(
                        "https://example.com/image.jpg", NOW, NOW.plusHours(1)))
                .isInstanceOf(IllegalStateException.class);

        ReviewImageAsset attached = newAsset();
        attached.completeUpload(
                "https://res.cloudinary.com/demo/image/upload/review.jpg",
                NOW,
                NOW.plusHours(1));
        attached.attach(new Review(), NOW);
        assertThatThrownBy(() -> attached.markDeletePending(NOW, null))
                .isInstanceOf(IllegalStateException.class);
        attached.markAttachedReviewDeleted(NOW);
        assertThat(attached.getStatus()).isEqualTo(ReviewImageAssetStatus.DELETE_PENDING);
        assertThat(attached.getReview()).isNull();
    }

    @Test
    void deletionClaimsAreFencedAndCanBeReleasedForRetry() {
        ReviewImageAsset asset = newAsset();
        asset.markDeletePending(NOW, NOW.plusHours(24));
        UUID claimId = UUID.fromString("73421963-815f-4da0-8825-fc56bf3658b3");

        asset.claimDeletion(claimId, NOW, NOW.plusHours(24));

        assertThat(asset.getStatus()).isEqualTo(ReviewImageAssetStatus.DELETE_PENDING);
        assertThat(asset.getDeletionClaimId()).isEqualTo(claimId);
        assertThat(asset.getCleanupOriginStatus()).isEqualTo(ReviewImageAssetStatus.UPLOADING);
        assertThat(asset.getCleanupNotFoundSafeAt()).isEqualTo(NOW.plusHours(24));
        assertThat(asset.isDeletionClaimedBy(claimId)).isTrue();
        assertThatThrownBy(() -> asset.releaseDeletion(UUID.randomUUID(), NOW.plusMinutes(1)))
                .isInstanceOf(IllegalStateException.class);

        asset.releaseDeletion(claimId, NOW.plusMinutes(1));
        assertThat(asset.getStatus()).isEqualTo(ReviewImageAssetStatus.DELETE_PENDING);
        assertThat(asset.getDeletionClaimId()).isNull();
        assertThat(asset.getCleanupAvailableAt()).isEqualTo(NOW.plusMinutes(1));
        assertThat(asset.getCleanupAttempts()).isEqualTo(1);
    }

    private ReviewImageAsset newAsset() {
        return new ReviewImageAsset(
                UUID.fromString("ab4fd622-a3b6-45cc-bf73-b1f2ff45b76d"),
                "fishnote/reviews/ab4fd622-a3b6-45cc-bf73-b1f2ff45b76d",
                "v1:7c9e76c7fe3a8c9d7c9e76c7fe3a8c9d7c9e76c7fe3a8c9d7c9e76c7fe3a8c9d",
                NOW.plusHours(1));
    }
}
