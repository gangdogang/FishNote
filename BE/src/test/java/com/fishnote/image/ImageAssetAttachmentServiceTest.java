package com.fishnote.image;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.fishnote.review.Review;
import java.lang.reflect.Method;
import java.time.Clock;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.core.annotation.AnnotationUtils;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

@ExtendWith(MockitoExtension.class)
class ImageAssetAttachmentServiceTest {

    private static final UUID ASSET_ID =
            UUID.fromString("ab4fd622-a3b6-45cc-bf73-b1f2ff45b76d");
    private static final String PUBLIC_ID = "fishnote/reviews/" + ASSET_ID;
    private static final String URL =
            "https://res.cloudinary.com/demo/image/upload/" + PUBLIC_ID + ".jpg";
    private static final String UPLOADER_KEY =
            "v1:7c9e76c7fe3a8c9d7c9e76c7fe3a8c9d7c9e76c7fe3a8c9d7c9e76c7fe3a8c9d";
    private static final Instant NOW = Instant.parse("2026-07-22T12:00:00Z");

    @Mock
    private ReviewImageAssetRepository repository;

    private ImageAssetAttachmentService service;
    private Review review;

    @BeforeEach
    void setUp() {
        service = new ImageAssetAttachmentService(
                repository,
                Clock.fixed(NOW, ZoneOffset.UTC));
        review = new Review();
        review.setId(100L);
    }

    @Test
    void attachesOwnedPendingAssetByIdAndReturnsCanonicalStoredUrl() {
        ReviewImageAsset asset = pendingAsset(NOW.plusSeconds(60));
        when(repository.findByIdForUpdate(ASSET_ID)).thenReturn(Optional.of(asset));

        assertThat(service.attach(ASSET_ID, URL, UPLOADER_KEY, review)).isEqualTo(URL);

        assertThat(asset.getStatus()).isEqualTo(ReviewImageAssetStatus.ATTACHED);
        assertThat(asset.getReview()).isSameAs(review);
        assertThat(asset.getAttachedAt()).isEqualTo(OffsetDateTime.ofInstant(NOW, ZoneOffset.UTC));
        verify(repository).saveAndFlush(asset);
    }

    @Test
    void exactUrlLookupKeepsCompatibilityWithCachedUrlOnlyClients() {
        ReviewImageAsset asset = pendingAsset(NOW.plusSeconds(60));
        when(repository.findBySecureUrlForUpdate(URL)).thenReturn(Optional.of(asset));

        assertThat(service.attach(null, URL, UPLOADER_KEY, review)).isEqualTo(URL);
        assertThat(asset.getStatus()).isEqualTo(ReviewImageAssetStatus.ATTACHED);
    }

    @Test
    void noImageDoesNotTouchAssetStorage() {
        assertThat(service.attach(null, null, null, review)).isNull();
        verifyNoInteractions(repository);
    }

    @Test
    void missingExpiredWrongOwnerUrlAndUsedAssetsAreRejected() {
        when(repository.findByIdForUpdate(ASSET_ID))
                .thenReturn(Optional.empty())
                .thenReturn(Optional.of(pendingAsset(NOW.minusSeconds(1))))
                .thenReturn(Optional.of(pendingAsset(NOW.plusSeconds(60))))
                .thenReturn(Optional.of(pendingAsset(NOW.plusSeconds(60))))
                .thenReturn(Optional.of(attachedAsset()));

        assertInvalid(() -> service.attach(ASSET_ID, URL, UPLOADER_KEY, review));
        assertInvalid(() -> service.attach(ASSET_ID, URL, UPLOADER_KEY, review));
        assertInvalid(() -> service.attach(
                ASSET_ID,
                URL,
                "v1:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
                review));
        assertInvalid(() -> service.attach(
                ASSET_ID,
                "https://res.cloudinary.com/demo/image/upload/other.jpg",
                UPLOADER_KEY,
                review));
        assertInvalid(() -> service.attach(ASSET_ID, URL, UPLOADER_KEY, review));
    }

    @Test
    void attachRequiresTheReviewCreationTransaction() throws Exception {
        Method method = ImageAssetAttachmentService.class.getMethod(
                "attach", UUID.class, String.class, String.class, Review.class);
        Transactional transactional = AnnotationUtils.findAnnotation(method, Transactional.class);

        assertThat(transactional).isNotNull();
        assertThat(transactional.propagation()).isEqualTo(Propagation.MANDATORY);
    }

    @Test
    void queuesAttachedImageWhenItsReviewIsDeleted() {
        ReviewImageAsset asset = pendingAsset(NOW.plusSeconds(60));
        asset.attach(review, OffsetDateTime.ofInstant(NOW.minusSeconds(1), ZoneOffset.UTC));
        when(repository.findByReviewIdForUpdate(review.getId())).thenReturn(Optional.of(asset));

        service.queueReviewImageDeletion(review.getId());

        assertThat(asset.getStatus()).isEqualTo(ReviewImageAssetStatus.DELETE_PENDING);
        assertThat(asset.getReview()).isNull();
        assertThat(asset.getCleanupAvailableAt())
                .isEqualTo(OffsetDateTime.ofInstant(NOW, ZoneOffset.UTC));
        assertThat(asset.getCleanupAttempts()).isZero();
        assertThat(asset.getCleanupOriginStatus()).isEqualTo(ReviewImageAssetStatus.ATTACHED);
        verify(repository).saveAndFlush(asset);
    }

    @Test
    void reviewWithoutTrackedImageDeletesWithoutAssetMutation() {
        when(repository.findByReviewIdForUpdate(review.getId())).thenReturn(Optional.empty());

        service.queueReviewImageDeletion(review.getId());

        verify(repository).findByReviewIdForUpdate(review.getId());
        verify(repository, org.mockito.Mockito.never()).saveAndFlush(org.mockito.ArgumentMatchers.any());
    }

    @Test
    void reviewImageDeletionRequiresTheReviewDeletionTransaction() throws Exception {
        Method method = ImageAssetAttachmentService.class.getMethod(
                "queueReviewImageDeletion", Long.class);
        Transactional transactional = AnnotationUtils.findAnnotation(method, Transactional.class);

        assertThat(transactional).isNotNull();
        assertThat(transactional.propagation()).isEqualTo(Propagation.MANDATORY);
    }

    private ReviewImageAsset pendingAsset(Instant expiresAt) {
        ReviewImageAsset asset = new ReviewImageAsset(
                ASSET_ID,
                PUBLIC_ID,
                UPLOADER_KEY,
                OffsetDateTime.ofInstant(expiresAt, ZoneOffset.UTC));
        asset.completeUpload(
                URL,
                OffsetDateTime.ofInstant(NOW.minusSeconds(5), ZoneOffset.UTC),
                OffsetDateTime.ofInstant(expiresAt, ZoneOffset.UTC));
        return asset;
    }

    private ReviewImageAsset attachedAsset() {
        ReviewImageAsset asset = pendingAsset(NOW.plusSeconds(60));
        asset.attach(new Review(), OffsetDateTime.ofInstant(NOW.minusSeconds(1), ZoneOffset.UTC));
        return asset;
    }

    private void assertInvalid(org.assertj.core.api.ThrowableAssert.ThrowingCallable callable) {
        assertThatThrownBy(callable)
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("imageUrl은 이미지 업로드로 발급된 자산만 사용할 수 있습니다.");
    }
}
