package com.fishnote.image;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.fishnote.review.Review;
import java.lang.reflect.Method;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayDeque;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.core.annotation.AnnotationUtils;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

@ExtendWith(MockitoExtension.class)
class ImageAssetCleanupPersistenceServiceTest {

    private static final OffsetDateTime NOW =
            OffsetDateTime.of(2026, 7, 22, 12, 0, 0, 0, ZoneOffset.UTC);
    private static final OffsetDateTime UPLOADING_BEFORE = NOW.minusMinutes(10);
    private static final OffsetDateTime STALE_BEFORE = NOW.minusMinutes(15);
    private static final String UPLOADER_KEY =
            "v1:7c9e76c7fe3a8c9d7c9e76c7fe3a8c9d7c9e76c7fe3a8c9d7c9e76c7fe3a8c9d";

    @Mock
    private ReviewImageAssetRepository repository;

    @Test
    void claimsEveryRecoverableStateAndSkipsAStillAttachedAsset() {
        ReviewImageAsset uploading = asset("00000000-0000-0000-0000-000000000001", NOW.minusMinutes(11));
        ReviewImageAsset pending = asset("00000000-0000-0000-0000-000000000002", NOW.minusSeconds(1));
        pending.completeUpload(url(pending), NOW.minusMinutes(2), NOW.minusSeconds(1));
        ReviewImageAsset deletePending = asset("00000000-0000-0000-0000-000000000003", NOW.plusHours(1));
        deletePending.markDeletePending(NOW.minusMinutes(1), NOW.plusHours(24));
        ReviewImageAsset orphan = attachedAsset("00000000-0000-0000-0000-000000000004");
        ReflectionTestUtils.setField(orphan, "review", null);
        ReviewImageAsset staleDeleting = asset("00000000-0000-0000-0000-000000000005", NOW.plusHours(1));
        staleDeleting.markDeletePending(NOW.minusMinutes(30), NOW.plusHours(24));
        staleDeleting.claimDeletion(
                UUID.fromString("10000000-0000-0000-0000-000000000005"),
                NOW.minusMinutes(20),
                NOW.plusHours(24));
        ReflectionTestUtils.setField(staleDeleting, "updatedAt", STALE_BEFORE.minusSeconds(1));
        ReviewImageAsset liveAttached = attachedAsset("00000000-0000-0000-0000-000000000006");

        when(repository.findCleanupCandidates(NOW, UPLOADING_BEFORE, STALE_BEFORE, 10))
                .thenReturn(List.of(
                        uploading, pending, deletePending, orphan, staleDeleting, liveAttached));
        ArrayDeque<UUID> claimIds = new ArrayDeque<>(List.of(
                UUID.fromString("20000000-0000-0000-0000-000000000001"),
                UUID.fromString("20000000-0000-0000-0000-000000000002"),
                UUID.fromString("20000000-0000-0000-0000-000000000003"),
                UUID.fromString("20000000-0000-0000-0000-000000000004"),
                UUID.fromString("20000000-0000-0000-0000-000000000005")));
        ImageAssetCleanupPersistenceService service =
                new ImageAssetCleanupPersistenceService(repository, claimIds::removeFirst);

        List<ImageAssetCleanupPersistenceService.DeletionClaim> claims =
                service.claimBatch(
                        NOW,
                        UPLOADING_BEFORE,
                        STALE_BEFORE,
                        NOW.plusHours(24),
                        10);

        assertThat(claims).extracting(ImageAssetCleanupPersistenceService.DeletionClaim::previousStatus)
                .containsExactly(
                        ReviewImageAssetStatus.UPLOADING,
                        ReviewImageAssetStatus.PENDING,
                        ReviewImageAssetStatus.DELETE_PENDING,
                        ReviewImageAssetStatus.ATTACHED,
                        ReviewImageAssetStatus.DELETE_PENDING);
        assertThat(List.of(uploading, pending, deletePending, orphan, staleDeleting))
                .allMatch(asset -> asset.getStatus() == ReviewImageAssetStatus.DELETE_PENDING)
                .allMatch(asset -> asset.getDeletionClaimId() != null)
                .allMatch(asset -> asset.getReview() == null);
        assertThat(liveAttached.getStatus()).isEqualTo(ReviewImageAssetStatus.ATTACHED);
        assertThat(claims.get(0).cleanupOriginStatus())
                .isEqualTo(ReviewImageAssetStatus.UPLOADING);
        assertThat(claims.get(0).cleanupNotFoundSafeAt()).isEqualTo(NOW.plusHours(24));
        assertThat(claims.get(4).cleanupOriginStatus())
                .isEqualTo(ReviewImageAssetStatus.UPLOADING);
        assertThat(claims.get(4).attempt()).isEqualTo(2);
        verify(repository).saveAllAndFlush(anyList());
    }

    @Test
    void completionAndReleaseOnlyAffectTheMatchingClaim() {
        UUID claimId = UUID.fromString("30000000-0000-0000-0000-000000000001");
        ReviewImageAsset completed = asset("00000000-0000-0000-0000-000000000011", NOW);
        completed.markDeletePending(NOW, NOW.plusHours(24));
        completed.claimDeletion(claimId, NOW, NOW.plusHours(24));
        when(repository.findByIdForUpdate(completed.getId())).thenReturn(Optional.of(completed));
        ImageAssetCleanupPersistenceService service =
                new ImageAssetCleanupPersistenceService(repository, UUID::randomUUID);

        assertThat(service.completeDeletion(completed.getId(), claimId)).isTrue();
        verify(repository).delete(completed);
        verify(repository).flush();

        ReviewImageAsset released = asset("00000000-0000-0000-0000-000000000012", NOW);
        released.markDeletePending(NOW, NOW.plusHours(24));
        released.claimDeletion(claimId, NOW, NOW.plusHours(24));
        when(repository.findByIdForUpdate(released.getId())).thenReturn(Optional.of(released));

        assertThat(service.releaseDeletion(released.getId(), claimId, NOW.plusMinutes(10))).isTrue();
        assertThat(released.getStatus()).isEqualTo(ReviewImageAssetStatus.DELETE_PENDING);
        assertThat(released.getDeletionClaimId()).isNull();
        assertThat(released.getCleanupAvailableAt()).isEqualTo(NOW.plusMinutes(10));
        verify(repository).saveAndFlush(released);
    }

    @Test
    void rollingDeployLegacyDeletePendingRowGetsAConservativeUploadTombstone() {
        ReviewImageAsset legacy = asset(
                "00000000-0000-0000-0000-000000000013", NOW.plusHours(1));
        ReflectionTestUtils.setField(legacy, "status", ReviewImageAssetStatus.DELETE_PENDING);
        when(repository.findCleanupCandidates(NOW, UPLOADING_BEFORE, STALE_BEFORE, 1))
                .thenReturn(List.of(legacy));
        UUID claimId = UUID.fromString("50000000-0000-0000-0000-000000000013");
        ImageAssetCleanupPersistenceService service =
                new ImageAssetCleanupPersistenceService(repository, () -> claimId);

        var claim = service.claimBatch(
                        NOW,
                        UPLOADING_BEFORE,
                        STALE_BEFORE,
                        NOW.plusHours(24),
                        1)
                .get(0);

        assertThat(claim.previousStatus()).isEqualTo(ReviewImageAssetStatus.DELETE_PENDING);
        assertThat(claim.cleanupOriginStatus()).isEqualTo(ReviewImageAssetStatus.UPLOADING);
        assertThat(claim.cleanupNotFoundSafeAt()).isEqualTo(NOW.plusHours(24));
        assertThat(legacy.getStatus()).isEqualTo(ReviewImageAssetStatus.DELETE_PENDING);
        assertThat(legacy.getDeletionClaimId()).isEqualTo(claimId);
    }

    @Test
    void staleWorkerCannotFinalizeOrReleaseANewerClaim() {
        UUID activeClaim = UUID.fromString("40000000-0000-0000-0000-000000000001");
        UUID staleClaim = UUID.fromString("40000000-0000-0000-0000-000000000002");
        ReviewImageAsset asset = asset("00000000-0000-0000-0000-000000000021", NOW);
        asset.markDeletePending(NOW, NOW.plusHours(24));
        asset.claimDeletion(activeClaim, NOW, NOW.plusHours(24));
        when(repository.findByIdForUpdate(asset.getId())).thenReturn(Optional.of(asset));
        ImageAssetCleanupPersistenceService service =
                new ImageAssetCleanupPersistenceService(repository, UUID::randomUUID);

        assertThat(service.completeDeletion(asset.getId(), staleClaim)).isFalse();
        assertThat(service.releaseDeletion(asset.getId(), staleClaim, NOW.plusMinutes(10))).isFalse();

        assertThat(asset.getStatus()).isEqualTo(ReviewImageAssetStatus.DELETE_PENDING);
        assertThat(asset.getDeletionClaimId()).isEqualTo(activeClaim);
        verify(repository, never()).delete(asset);
        verify(repository, never()).saveAndFlush(asset);
    }

    @Test
    void cleanupPersistenceUsesIndependentBoundedTransactions() throws Exception {
        for (Method method : List.of(
                ImageAssetCleanupPersistenceService.class.getMethod(
                        "claimBatch",
                        OffsetDateTime.class,
                        OffsetDateTime.class,
                        OffsetDateTime.class,
                        OffsetDateTime.class,
                        int.class),
                ImageAssetCleanupPersistenceService.class.getMethod(
                        "completeDeletion", UUID.class, UUID.class),
                ImageAssetCleanupPersistenceService.class.getMethod(
                        "releaseDeletion", UUID.class, UUID.class, OffsetDateTime.class))) {
            Transactional transactional = AnnotationUtils.findAnnotation(method, Transactional.class);
            assertThat(transactional).isNotNull();
            assertThat(transactional.propagation()).isEqualTo(Propagation.REQUIRES_NEW);
        }

        ImageAssetCleanupPersistenceService service =
                new ImageAssetCleanupPersistenceService(repository, UUID::randomUUID);
        assertThatThrownBy(() -> service.claimBatch(
                        NOW, UPLOADING_BEFORE, STALE_BEFORE, NOW.plusHours(24), 0))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> service.claimBatch(
                        NOW, UPLOADING_BEFORE, STALE_BEFORE, NOW.plusHours(24), 1_001))
                .isInstanceOf(IllegalArgumentException.class);
    }

    private ReviewImageAsset attachedAsset(String id) {
        ReviewImageAsset asset = asset(id, NOW.plusHours(1));
        asset.completeUpload(url(asset), NOW.minusMinutes(2), NOW.plusHours(1));
        Review review = new Review();
        review.setId(Long.parseLong(id.substring(id.length() - 3)));
        asset.attach(review, NOW.minusMinutes(1));
        return asset;
    }

    private ReviewImageAsset asset(String id, OffsetDateTime expiresAt) {
        UUID assetId = UUID.fromString(id);
        return new ReviewImageAsset(
                assetId,
                "fishnote/reviews/" + assetId,
                UPLOADER_KEY,
                expiresAt);
    }

    private String url(ReviewImageAsset asset) {
        return "https://res.cloudinary.com/test/image/upload/" + asset.getPublicId() + ".jpg";
    }
}
