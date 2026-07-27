package com.fishnote.image;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyMap;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.cloudinary.Cloudinary;
import com.cloudinary.Uploader;
import java.io.IOException;
import java.lang.reflect.Method;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.core.annotation.AnnotationUtils;
import org.springframework.transaction.annotation.Transactional;

@ExtendWith(MockitoExtension.class)
class ImageAssetCleanupJobTest {

    private static final Instant NOW = Instant.parse("2026-07-22T12:00:00Z");
    private static final OffsetDateTime NOW_OFFSET = OffsetDateTime.ofInstant(NOW, ZoneOffset.UTC);

    @Mock
    private Cloudinary cloudinary;

    @Mock
    private Uploader uploader;

    @Mock
    private ImageAssetCleanupPersistenceService persistenceService;

    private ImageAssetCleanupJob job;

    @BeforeEach
    void setUp() {
        org.mockito.Mockito.lenient().when(cloudinary.uploader()).thenReturn(uploader);
        job = new ImageAssetCleanupJob(
                cloudinary,
                persistenceService,
                50,
                Duration.ofMinutes(15),
                Duration.ofMinutes(10),
                Duration.ofMinutes(10),
                Duration.ofHours(6),
                Duration.ofHours(24),
                Clock.fixed(NOW, ZoneOffset.UTC));
    }

    @Test
    void okAndAlreadyMissingResultsFinalizeRowsOutsideTheClaimTransaction() throws Exception {
        var deleted = claim(1, ReviewImageAssetStatus.DELETE_PENDING);
        var missing = claim(2, ReviewImageAssetStatus.PENDING);
        when(persistenceService.claimBatch(
                        NOW_OFFSET,
                        NOW_OFFSET.minusMinutes(10),
                        NOW_OFFSET.minusMinutes(15),
                        NOW_OFFSET.plusHours(24),
                        50))
                .thenReturn(List.of(deleted, missing));
        when(uploader.destroy(eq(deleted.publicId()), anyMap()))
                .thenReturn(Map.of("result", "ok"));
        when(uploader.destroy(eq(missing.publicId()), anyMap()))
                .thenReturn(Map.of("result", "not found"));
        when(persistenceService.completeDeletion(deleted.assetId(), deleted.claimId()))
                .thenReturn(true);
        when(persistenceService.completeDeletion(missing.assetId(), missing.claimId()))
                .thenReturn(true);

        job.cleanup();

        verify(persistenceService).completeDeletion(deleted.assetId(), deleted.claimId());
        verify(persistenceService).completeDeletion(missing.assetId(), missing.claimId());
        @SuppressWarnings("unchecked")
        ArgumentCaptor<Map<String, Object>> options = ArgumentCaptor.forClass(Map.class);
        verify(uploader).destroy(eq(deleted.publicId()), options.capture());
        assertThat(options.getValue())
                .containsEntry("resource_type", "image")
                .containsEntry("invalidate", true);
    }

    @Test
    void firstNotFoundForAnUploadingReservationIsDeferred() throws Exception {
        var uploading = claim(
                3,
                ReviewImageAssetStatus.DELETE_PENDING,
                ReviewImageAssetStatus.UPLOADING,
                NOW_OFFSET.plusHours(24));
        when(persistenceService.claimBatch(
                        NOW_OFFSET,
                        NOW_OFFSET.minusMinutes(10),
                        NOW_OFFSET.minusMinutes(15),
                        NOW_OFFSET.plusHours(24),
                        50))
                .thenReturn(List.of(uploading));
        when(uploader.destroy(uploading.publicId(), Map.of(
                        "resource_type", "image", "invalidate", true)))
                .thenReturn(Map.of("result", "not found"));

        job.cleanup();

        verify(persistenceService).releaseDeletion(
                uploading.assetId(), uploading.claimId(), NOW_OFFSET.plusMinutes(10));
        verify(persistenceService, never()).completeDeletion(uploading.assetId(), uploading.claimId());
    }

    @Test
    void uploadingTombstoneBecomesTerminalOnlyAfterItsSafetyHorizon() throws Exception {
        var settledUploading = claim(
                8,
                ReviewImageAssetStatus.DELETE_PENDING,
                ReviewImageAssetStatus.UPLOADING,
                NOW_OFFSET.minusSeconds(1));
        when(persistenceService.claimBatch(
                        NOW_OFFSET,
                        NOW_OFFSET.minusMinutes(10),
                        NOW_OFFSET.minusMinutes(15),
                        NOW_OFFSET.plusHours(24),
                        50))
                .thenReturn(List.of(settledUploading));
        when(uploader.destroy(eq(settledUploading.publicId()), anyMap()))
                .thenReturn(Map.of("result", "not found"));
        when(persistenceService.completeDeletion(
                        settledUploading.assetId(), settledUploading.claimId()))
                .thenReturn(true);

        job.cleanup();

        verify(persistenceService).completeDeletion(
                settledUploading.assetId(), settledUploading.claimId());
        verify(persistenceService, never()).releaseDeletion(
                eq(settledUploading.assetId()),
                eq(settledUploading.claimId()),
                org.mockito.ArgumentMatchers.any());
    }

    @Test
    void failuresAndUnknownResultsReleaseClaimsAndDoNotStopTheBatch() throws Exception {
        var failed = claim(4, ReviewImageAssetStatus.DELETE_PENDING);
        var unknown = claim(5, ReviewImageAssetStatus.DELETE_PENDING);
        var succeeding = claim(6, ReviewImageAssetStatus.DELETE_PENDING);
        when(persistenceService.claimBatch(
                        NOW_OFFSET,
                        NOW_OFFSET.minusMinutes(10),
                        NOW_OFFSET.minusMinutes(15),
                        NOW_OFFSET.plusHours(24),
                        50))
                .thenReturn(List.of(failed, unknown, succeeding));
        when(uploader.destroy(eq(failed.publicId()), anyMap()))
                .thenThrow(new IOException("remote failure with sensitive details"));
        when(uploader.destroy(eq(unknown.publicId()), anyMap()))
                .thenReturn(Map.of("result", "pending"));
        when(uploader.destroy(eq(succeeding.publicId()), anyMap()))
                .thenReturn(Map.of("result", "ok"));
        when(persistenceService.completeDeletion(succeeding.assetId(), succeeding.claimId()))
                .thenReturn(true);

        job.cleanup();

        verify(persistenceService).releaseDeletion(
                failed.assetId(), failed.claimId(), NOW_OFFSET.plusMinutes(10));
        verify(persistenceService).releaseDeletion(
                unknown.assetId(), unknown.claimId(), NOW_OFFSET.plusMinutes(10));
        verify(persistenceService).completeDeletion(succeeding.assetId(), succeeding.claimId());
    }

    @Test
    void finalizationFailureLeavesARecoverableClaim() throws Exception {
        var claim = claim(7, ReviewImageAssetStatus.DELETE_PENDING);
        when(persistenceService.claimBatch(
                        NOW_OFFSET,
                        NOW_OFFSET.minusMinutes(10),
                        NOW_OFFSET.minusMinutes(15),
                        NOW_OFFSET.plusHours(24),
                        50))
                .thenReturn(List.of(claim));
        when(uploader.destroy(eq(claim.publicId()), anyMap()))
                .thenReturn(Map.of("result", "ok"));
        doThrow(new RuntimeException("database unavailable"))
                .when(persistenceService)
                .completeDeletion(claim.assetId(), claim.claimId());

        job.cleanup();

        verify(persistenceService).releaseDeletion(
                claim.assetId(), claim.claimId(), NOW_OFFSET.plusMinutes(10));
    }

    @Test
    void schedulerCoordinatorDoesNotOpenADatabaseTransaction() throws Exception {
        Method cleanup = ImageAssetCleanupJob.class.getMethod("cleanup");
        assertThat(AnnotationUtils.findAnnotation(cleanup, Transactional.class)).isNull();
    }

    private ImageAssetCleanupPersistenceService.DeletionClaim claim(
            int suffix,
            ReviewImageAssetStatus previousStatus) {
        return claim(suffix, previousStatus, previousStatus, null);
    }

    private ImageAssetCleanupPersistenceService.DeletionClaim claim(
            int suffix,
            ReviewImageAssetStatus previousStatus,
            ReviewImageAssetStatus cleanupOriginStatus,
            OffsetDateTime cleanupNotFoundSafeAt) {
        UUID assetId = UUID.fromString(String.format(
                "00000000-0000-0000-0000-%012d", suffix));
        UUID claimId = UUID.fromString(String.format(
                "10000000-0000-0000-0000-%012d", suffix));
        return new ImageAssetCleanupPersistenceService.DeletionClaim(
                assetId,
                "fishnote/reviews/" + assetId,
                claimId,
                previousStatus,
                cleanupOriginStatus,
                cleanupNotFoundSafeAt,
                1);
    }
}
