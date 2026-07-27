package com.fishnote.image;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyMap;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.spy;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.cloudinary.Cloudinary;
import com.cloudinary.Uploader;
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
import org.mockito.InOrder;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.web.multipart.MultipartFile;

@ExtendWith(MockitoExtension.class)
class ImageServiceTest {

    private static final UUID ASSET_ID =
            UUID.fromString("ab4fd622-a3b6-45cc-bf73-b1f2ff45b76d");
    private static final String PUBLIC_ID = "fishnote/reviews/" + ASSET_ID;
    private static final String CLOUDINARY_URL =
            "https://res.cloudinary.com/demo/image/upload/v1784710000/" + PUBLIC_ID + ".jpg";
    private static final String UPLOADER_KEY =
            "v1:7c9e76c7fe3a8c9d7c9e76c7fe3a8c9d7c9e76c7fe3a8c9d7c9e76c7fe3a8c9d";
    private static final int TEST_MAX_DIMENSION = 32;
    private static final long TEST_MAX_PIXELS = 100;
    private static final Instant NOW = Instant.parse("2026-07-22T12:00:00Z");

    @Mock
    private Uploader uploader;

    @Mock
    private MultipartFile underReportedFile;

    @Mock
    private ImageAssetPersistenceService assetPersistenceService;

    private Cloudinary cloudinary;
    private ImageService imageService;

    @BeforeEach
    void setUp() {
        cloudinary = spy(new Cloudinary("cloudinary://test-key:test-secret@demo"));
        org.mockito.Mockito.lenient().doReturn(uploader).when(cloudinary).uploader();
        imageService = new ImageService(
                cloudinary,
                assetPersistenceService,
                TEST_MAX_DIMENSION,
                TEST_MAX_PIXELS,
                Duration.ofHours(1),
                Clock.fixed(NOW, ZoneOffset.UTC),
                () -> ASSET_ID);
    }

    @Test
    void reservesBeforeUploadAndReturnsTrackedAsset() throws Exception {
        MockMultipartFile file = imageFile(
                "review.jpg", MediaType.IMAGE_JPEG_VALUE, ImageTestFixtures.imageBytes("jpeg", 2, 2));
        when(uploader.upload(any(byte[].class), anyMap())).thenReturn(validUploadResult());

        var response = imageService.upload(file, UPLOADER_KEY);

        assertThat(response.url()).isEqualTo(CLOUDINARY_URL);
        assertThat(response.assetId()).isEqualTo(ASSET_ID);
        assertThat(response.expiresAt()).isEqualTo(OffsetDateTime.ofInstant(NOW, ZoneOffset.UTC).plusHours(1));

        @SuppressWarnings("unchecked")
        ArgumentCaptor<Map<String, Object>> optionsCaptor = ArgumentCaptor.forClass(Map.class);
        InOrder order = inOrder(assetPersistenceService, uploader);
        order.verify(assetPersistenceService).reserve(
                ASSET_ID,
                PUBLIC_ID,
                UPLOADER_KEY,
                OffsetDateTime.ofInstant(NOW, ZoneOffset.UTC).plusHours(1));
        order.verify(uploader).upload(any(byte[].class), optionsCaptor.capture());
        order.verify(assetPersistenceService).completeUpload(
                ASSET_ID,
                PUBLIC_ID,
                CLOUDINARY_URL,
                OffsetDateTime.ofInstant(NOW, ZoneOffset.UTC),
                OffsetDateTime.ofInstant(NOW, ZoneOffset.UTC).plusHours(1));
        assertThat(optionsCaptor.getValue())
                .containsEntry("public_id", PUBLIC_ID)
                .containsEntry("overwrite", false)
                .containsEntry("unique_filename", false)
                .containsEntry("resource_type", "image");
    }

    @Test
    void missingAndEmptyFilesAreRejectedBeforeReservationOrCloudinary() {
        assertRejectedBeforeUpload(null, "파일은 필수입니다.");
        assertRejectedBeforeUpload(
                imageFile("empty.jpg", MediaType.IMAGE_JPEG_VALUE, new byte[0]),
                "파일은 필수입니다.");
    }

    @Test
    void declaredOrActualBytesLargerThanFiveMbAreRejectedBeforeCloudinary() throws Exception {
        byte[] tooLarge = new byte[(5 * 1024 * 1024) + 1];
        assertRejectedBeforeUpload(
                imageFile("large.jpg", MediaType.IMAGE_JPEG_VALUE, tooLarge),
                "이미지는 5MB 이하만 업로드할 수 있습니다.");

        when(underReportedFile.isEmpty()).thenReturn(false);
        when(underReportedFile.getSize()).thenReturn(1L);
        when(underReportedFile.getContentType()).thenReturn(MediaType.IMAGE_JPEG_VALUE);
        when(underReportedFile.getBytes()).thenReturn(tooLarge);
        assertRejectedBeforeUpload(
                underReportedFile,
                "이미지는 5MB 이하만 업로드할 수 있습니다.");
    }

    @Test
    void nonImageSpoofedMismatchedAndTruncatedFilesNeverReachCloudinary() throws Exception {
        assertRejectedBeforeUpload(
                imageFile("memo.txt", MediaType.TEXT_PLAIN_VALUE, "text".getBytes()),
                "이미지 파일만 업로드할 수 있습니다.");
        assertRejectedBeforeUpload(
                imageFile("fake.jpg", MediaType.IMAGE_JPEG_VALUE, "not-an-image-at-all".getBytes()),
                "지원하는 이미지 파일만 업로드할 수 있습니다.");
        assertRejectedBeforeUpload(
                imageFile(
                        "wrong.jpg",
                        MediaType.IMAGE_JPEG_VALUE,
                        ImageTestFixtures.imageBytes("png", 2, 2)),
                "지원하는 이미지 파일만 업로드할 수 있습니다.");

        byte[] truncatedJpeg = {(byte) 0xFF, (byte) 0xD8, (byte) 0xFF, (byte) 0xE0};
        assertRejectedBeforeUpload(
                imageFile("truncated.jpg", MediaType.IMAGE_JPEG_VALUE, truncatedJpeg),
                "지원하는 이미지 파일만 업로드할 수 있습니다.");
    }

    @Test
    void incompleteAndAnimatedContainersNeverReachCloudinary() throws Exception {
        byte[] png = ImageTestFixtures.imageBytes("png", 1, 1);
        byte[] jpeg = ImageTestFixtures.imageBytes("jpeg", 1, 1);

        assertRejectedBeforeUpload(
                imageFile("header-only.png", MediaType.IMAGE_PNG_VALUE, java.util.Arrays.copyOf(png, 33)),
                "지원하는 이미지 파일만 업로드할 수 있습니다.");
        assertRejectedBeforeUpload(
                imageFile(
                        "truncated.jpg",
                        MediaType.IMAGE_JPEG_VALUE,
                        ImageTestFixtures.withoutLastBytes(jpeg, 2)),
                "지원하는 이미지 파일만 업로드할 수 있습니다.");
        assertRejectedBeforeUpload(
                imageFile("animated.gif", MediaType.IMAGE_GIF_VALUE, ImageTestFixtures.animatedGifBytes()),
                "지원하는 이미지 파일만 업로드할 수 있습니다.");
        assertRejectedBeforeUpload(
                imageFile("animated.png", MediaType.IMAGE_PNG_VALUE, ImageTestFixtures.apngBytes()),
                "지원하는 이미지 파일만 업로드할 수 있습니다.");
        assertRejectedBeforeUpload(
                imageFile("animated.webp", "image/webp", ImageTestFixtures.animatedWebpBytes()),
                "지원하는 이미지 파일만 업로드할 수 있습니다.");
        assertRejectedBeforeUpload(
                imageFile(
                        "corrupt-raster.png",
                        MediaType.IMAGE_PNG_VALUE,
                        ImageTestFixtures.corruptPngRasterWithValidChunkCrc()),
                "지원하는 이미지 파일만 업로드할 수 있습니다.");
    }

    @Test
    void excessiveDimensionAndPixelCountAreRejectedBeforeCloudinary() throws Exception {
        assertRejectedBeforeUpload(
                imageFile(
                        "wide.png",
                        MediaType.IMAGE_PNG_VALUE,
                        ImageTestFixtures.imageBytes("png", 33, 1)),
                "이미지 가로와 세로는 32px 이하여야 합니다.");
        assertRejectedBeforeUpload(
                imageFile(
                        "many-pixels.png",
                        MediaType.IMAGE_PNG_VALUE,
                        ImageTestFixtures.imageBytes("png", 11, 10)),
                "이미지 총 픽셀 수가 너무 큽니다.");

        byte[] hugeCanvasGif = ImageTestFixtures.imageBytes("gif", 1, 1);
        hugeCanvasGif[6] = (byte) 0xFF;
        hugeCanvasGif[7] = (byte) 0xFF;
        hugeCanvasGif[8] = (byte) 0xFF;
        hugeCanvasGif[9] = (byte) 0xFF;
        assertRejectedBeforeUpload(
                imageFile("huge-canvas.gif", MediaType.IMAGE_GIF_VALUE, hugeCanvasGif),
                "이미지 가로와 세로는 32px 이하여야 합니다.");
    }

    @Test
    void invalidUploaderKeyIsRejectedBeforeReservation() throws Exception {
        MockMultipartFile file = imageFile(
                "review.jpg", MediaType.IMAGE_JPEG_VALUE, ImageTestFixtures.imageBytes("jpeg", 2, 2));

        assertThatThrownBy(() -> imageService.upload(file, "203.0.113.42"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("올바른 이미지 업로더 키가 필요합니다.");
        verifyNoInteractions(assetPersistenceService);
        verify(uploader, never()).upload(any(), anyMap());
    }

    @Test
    void reservationFailureStopsBeforeCloudinary() throws Exception {
        MockMultipartFile file = imageFile(
                "review.jpg", MediaType.IMAGE_JPEG_VALUE, ImageTestFixtures.imageBytes("jpeg", 2, 2));
        doThrow(new RuntimeException("database unavailable"))
                .when(assetPersistenceService)
                .reserve(any(), any(), any(), any());

        assertThatThrownBy(() -> imageService.upload(file, UPLOADER_KEY))
                .isInstanceOf(ImageUploadException.class)
                .hasMessage("이미지 업로드에 실패했습니다.");
        verify(uploader, never()).upload(any(), anyMap());
        verify(assetPersistenceService, never()).markDeletePending(any());
    }

    @Test
    void cloudinaryAndFinalizeFailuresLeaveADeletionCandidate() throws Exception {
        MockMultipartFile file = imageFile(
                "review.jpg", MediaType.IMAGE_JPEG_VALUE, ImageTestFixtures.imageBytes("jpeg", 2, 2));
        when(uploader.upload(any(byte[].class), anyMap()))
                .thenThrow(new RuntimeException("cloudinary down"))
                .thenReturn(validUploadResult());

        assertThatThrownBy(() -> imageService.upload(file, UPLOADER_KEY))
                .isInstanceOf(ImageUploadException.class)
                .hasMessage("이미지 업로드에 실패했습니다.");
        verify(assetPersistenceService).markDeletePending(ASSET_ID);

        doThrow(new RuntimeException("finalize failed"))
                .when(assetPersistenceService)
                .completeUpload(
                        eq(ASSET_ID), eq(PUBLIC_ID), eq(CLOUDINARY_URL), any(), any());
        assertThatThrownBy(() -> imageService.upload(file, UPLOADER_KEY))
                .isInstanceOf(ImageUploadException.class)
                .hasMessage("이미지 업로드에 실패했습니다.");
        verify(assetPersistenceService, org.mockito.Mockito.times(2)).markDeletePending(ASSET_ID);
    }

    @Test
    void untrustedCloudinaryResponsesAreNeverFinalized() throws Exception {
        MockMultipartFile file = imageFile(
                "review.jpg", MediaType.IMAGE_JPEG_VALUE, ImageTestFixtures.imageBytes("jpeg", 2, 2));
        List<Map<String, Object>> invalidResults = List.of(
                Map.of("secure_url", CLOUDINARY_URL, "resource_type", "image"),
                Map.of(
                        "secure_url", CLOUDINARY_URL,
                        "public_id", "fishnote/reviews/other",
                        "resource_type", "image"),
                Map.of(
                        "secure_url", CLOUDINARY_URL,
                        "public_id", PUBLIC_ID,
                        "resource_type", "raw"),
                Map.of(
                        "secure_url", "http://res.cloudinary.com/demo/image/upload/" + PUBLIC_ID + ".jpg",
                        "public_id", PUBLIC_ID,
                        "resource_type", "image"),
                Map.of(
                        "secure_url", "https://res.cloudinary.com/other/image/upload/" + PUBLIC_ID + ".jpg",
                        "public_id", PUBLIC_ID,
                        "resource_type", "image"));

        for (Map<String, Object> invalidResult : invalidResults) {
            when(uploader.upload(any(byte[].class), anyMap())).thenReturn(invalidResult);
            assertThatThrownBy(() -> imageService.upload(file, UPLOADER_KEY))
                    .isInstanceOf(ImageUploadException.class)
                    .hasMessage("이미지 업로드에 실패했습니다.");
        }

        verify(assetPersistenceService, never()).completeUpload(any(), any(), any(), any(), any());
        verify(assetPersistenceService, org.mockito.Mockito.times(invalidResults.size()))
                .markDeletePending(ASSET_ID);
    }

    private Map<String, Object> validUploadResult() {
        return Map.of(
                "secure_url", CLOUDINARY_URL,
                "public_id", PUBLIC_ID,
                "resource_type", "image",
                "type", "upload");
    }

    private void assertRejectedBeforeUpload(MultipartFile file, String message) {
        assertThatThrownBy(() -> imageService.upload(file, UPLOADER_KEY))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage(message);
        verifyNoInteractions(assetPersistenceService);
        verifyNoInteractions(uploader);
    }

    private MockMultipartFile imageFile(String filename, String contentType, byte[] content) {
        return new MockMultipartFile("file", filename, contentType, content);
    }
}
