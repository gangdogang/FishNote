package com.fishnote.image;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.lang.reflect.Method;
import java.time.Clock;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.core.annotation.AnnotationUtils;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

@ExtendWith(MockitoExtension.class)
class ImageAssetPersistenceServiceTest {

    private static final UUID ASSET_ID =
            UUID.fromString("ab4fd622-a3b6-45cc-bf73-b1f2ff45b76d");
    private static final String PUBLIC_ID = "fishnote/reviews/" + ASSET_ID;
    private static final String UPLOADER_KEY =
            "v1:7c9e76c7fe3a8c9d7c9e76c7fe3a8c9d7c9e76c7fe3a8c9d7c9e76c7fe3a8c9d";
    private static final OffsetDateTime NOW =
            OffsetDateTime.of(2026, 7, 22, 12, 0, 0, 0, ZoneOffset.UTC);

    @Mock
    private ReviewImageAssetRepository repository;

    @Test
    void reservePersistsRecoverablePublicIdBeforeExternalUpload() {
        ImageAssetPersistenceService service = service();

        service.reserve(ASSET_ID, PUBLIC_ID, UPLOADER_KEY, NOW.plusHours(1));

        ArgumentCaptor<ReviewImageAsset> captor = ArgumentCaptor.forClass(ReviewImageAsset.class);
        verify(repository).saveAndFlush(captor.capture());
        assertThat(captor.getValue().getId()).isEqualTo(ASSET_ID);
        assertThat(captor.getValue().getPublicId()).isEqualTo(PUBLIC_ID);
        assertThat(captor.getValue().getUploaderKey()).isEqualTo(UPLOADER_KEY);
        assertThat(captor.getValue().getStatus()).isEqualTo(ReviewImageAssetStatus.UPLOADING);
    }

    @Test
    void completeAndFailureTransitionsKeepTheSameTrackedRow() {
        ImageAssetPersistenceService service = service();
        ReviewImageAsset asset =
                new ReviewImageAsset(ASSET_ID, PUBLIC_ID, UPLOADER_KEY, NOW.plusHours(1));
        when(repository.findByIdForUpdate(ASSET_ID)).thenReturn(Optional.of(asset));

        service.completeUpload(
                ASSET_ID,
                PUBLIC_ID,
                "https://res.cloudinary.com/demo/image/upload/" + PUBLIC_ID + ".jpg",
                NOW,
                NOW.plusHours(1));
        assertThat(asset.getStatus()).isEqualTo(ReviewImageAssetStatus.PENDING);
        assertThat(asset.getSecureUrl()).isNotBlank();

        service.markDeletePending(ASSET_ID);
        assertThat(asset.getStatus()).isEqualTo(ReviewImageAssetStatus.DELETE_PENDING);
        assertThat(asset.getCleanupAvailableAt()).isEqualTo(NOW);
        assertThat(asset.getCleanupOriginStatus()).isEqualTo(ReviewImageAssetStatus.PENDING);
        assertThat(asset.getCleanupNotFoundSafeAt()).isNull();
        assertThat(asset.getCleanupAttempts()).isZero();
        verify(repository, org.mockito.Mockito.times(2)).saveAndFlush(asset);
    }

    @Test
    void ambiguousUploadFailurePreservesUploadingOriginUntilTheSafetyHorizon() {
        ImageAssetPersistenceService service = service();
        ReviewImageAsset asset =
                new ReviewImageAsset(ASSET_ID, PUBLIC_ID, UPLOADER_KEY, NOW.plusHours(1));
        when(repository.findByIdForUpdate(ASSET_ID)).thenReturn(Optional.of(asset));

        service.markDeletePending(ASSET_ID);

        assertThat(asset.getStatus()).isEqualTo(ReviewImageAssetStatus.DELETE_PENDING);
        assertThat(asset.getCleanupOriginStatus()).isEqualTo(ReviewImageAssetStatus.UPLOADING);
        assertThat(asset.getCleanupNotFoundSafeAt()).isEqualTo(NOW.plusHours(24));
        assertThat(asset.getCleanupAttempts()).isZero();
        verify(repository).saveAndFlush(asset);
    }

    @Test
    void mismatchedPublicIdCannotFinalizeReservation() {
        ImageAssetPersistenceService service = service();
        ReviewImageAsset asset =
                new ReviewImageAsset(ASSET_ID, PUBLIC_ID, UPLOADER_KEY, NOW.plusHours(1));
        when(repository.findByIdForUpdate(ASSET_ID)).thenReturn(Optional.of(asset));

        assertThatThrownBy(() -> service.completeUpload(
                        ASSET_ID,
                        "fishnote/reviews/other",
                        "https://res.cloudinary.com/demo/image/upload/other.jpg",
                        NOW,
                        NOW.plusHours(1)))
                .isInstanceOf(IllegalStateException.class)
                .hasMessage("예약된 이미지 public_id가 일치하지 않습니다.");
    }

    @Test
    void persistenceBoundariesAlwaysUseIndependentShortTransactions() throws Exception {
        for (Method method : ListOfLifecycleMethods.ALL) {
            Transactional transactional =
                    AnnotationUtils.findAnnotation(method, Transactional.class);
            assertThat(transactional).isNotNull();
            assertThat(transactional.propagation()).isEqualTo(Propagation.REQUIRES_NEW);
        }
    }

    private static final class ListOfLifecycleMethods {
        private static final java.util.List<Method> ALL = java.util.List.of(
                method("reserve", UUID.class, String.class, String.class, OffsetDateTime.class),
                method(
                        "completeUpload",
                        UUID.class,
                        String.class,
                        String.class,
                        OffsetDateTime.class,
                        OffsetDateTime.class),
                method("markDeletePending", UUID.class));

        private static Method method(String name, Class<?>... parameterTypes) {
            try {
                return ImageAssetPersistenceService.class.getMethod(name, parameterTypes);
            } catch (NoSuchMethodException ex) {
                throw new ExceptionInInitializerError(ex);
            }
        }
    }

    private ImageAssetPersistenceService service() {
        return new ImageAssetPersistenceService(
                repository,
                Clock.fixed(NOW.toInstant(), ZoneOffset.UTC));
    }
}
