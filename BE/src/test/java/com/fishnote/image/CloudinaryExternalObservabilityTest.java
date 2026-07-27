package com.fishnote.image;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyMap;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.spy;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import com.cloudinary.Cloudinary;
import com.cloudinary.Uploader;
import com.fishnote.common.GlobalExceptionHandler;
import com.fishnote.observability.ExternalApiMetrics;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import java.io.IOException;
import java.net.SocketTimeoutException;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.slf4j.LoggerFactory;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockMultipartFile;

@ExtendWith(MockitoExtension.class)
class CloudinaryExternalObservabilityTest {

    private static final String DURATION_METRIC = "fishnote.external.api.duration";
    private static final String TIMEOUT_METRIC = "fishnote.external.api.timeouts";
    private static final Instant NOW = Instant.parse("2026-07-23T00:00:00Z");
    private static final UUID ASSET_ID =
            UUID.fromString("30000000-0000-0000-0000-000000000001");
    private static final String UPLOADER_KEY =
            "v1:7c9e76c7fe3a8c9d7c9e76c7fe3a8c9d7c9e76c7fe3a8c9d7c9e76c7fe3a8c9d";

    @Mock
    private Uploader uploader;

    @Mock
    private ImageAssetPersistenceService assetPersistenceService;

    @Mock
    private ImageAssetCleanupPersistenceService cleanupPersistenceService;

    private Cloudinary cloudinary;
    private SimpleMeterRegistry registry;
    private ExternalApiMetrics metrics;

    @BeforeEach
    void setUp() {
        cloudinary = spy(new Cloudinary("cloudinary://test-key:test-secret@demo"));
        org.mockito.Mockito.lenient().doReturn(uploader).when(cloudinary).uploader();
        registry = new SimpleMeterRegistry();
        metrics = new ExternalApiMetrics(registry);
    }

    @Test
    void uploadTimeoutRecordsBoundedCloudinaryMetricsAndPreservesCleanupState() throws Exception {
        String sensitiveRemoteMessage =
                "https://api.cloudinary.com/v1_1/demo/image/upload?api_secret=never-log-this";
        when(uploader.upload(any(byte[].class), anyMap()))
                .thenThrow(new SocketTimeoutException(sensitiveRemoteMessage));
        ImageService service = new ImageService(
                cloudinary,
                assetPersistenceService,
                32,
                100,
                Duration.ofHours(1),
                Clock.fixed(NOW, ZoneOffset.UTC),
                () -> ASSET_ID,
                metrics);
        MockMultipartFile file = new MockMultipartFile(
                "file",
                "review.jpg",
                MediaType.IMAGE_JPEG_VALUE,
                ImageTestFixtures.imageBytes("jpeg", 2, 2));

        assertThatThrownBy(() -> service.upload(file, UPLOADER_KEY))
                .isInstanceOf(ImageUploadException.class)
                .hasMessage("이미지 업로드에 실패했습니다.");

        assertThat(registry.get(TIMEOUT_METRIC)
                        .tags("provider", "cloudinary", "operation", "upload")
                        .counter()
                        .count())
                .isEqualTo(1);
        assertThat(registry.get(DURATION_METRIC)
                        .tags(
                                "provider", "cloudinary",
                                "operation", "upload",
                                "outcome", "timeout")
                        .timer()
                        .count())
                .isEqualTo(1);
        verify(assetPersistenceService).markDeletePending(ASSET_ID);
    }

    @Test
    void destroyFailureRecordsErrorOutcomeAndLeavesTheClaimRecoverable() throws Exception {
        OffsetDateTime now = OffsetDateTime.ofInstant(NOW, ZoneOffset.UTC);
        UUID claimId = UUID.fromString("40000000-0000-0000-0000-000000000001");
        var claim = new ImageAssetCleanupPersistenceService.DeletionClaim(
                ASSET_ID,
                "fishnote/reviews/" + ASSET_ID,
                claimId,
                ReviewImageAssetStatus.DELETE_PENDING,
                ReviewImageAssetStatus.DELETE_PENDING,
                null,
                1);
        when(cleanupPersistenceService.claimBatch(
                        now,
                        now.minusMinutes(10),
                        now.minusMinutes(15),
                        now.plusHours(24),
                        50))
                .thenReturn(List.of(claim));
        when(uploader.destroy(eq(claim.publicId()), anyMap()))
                .thenThrow(new IOException("remote payload and URL must stay out of logs"));
        ImageAssetCleanupJob job = new ImageAssetCleanupJob(
                cloudinary,
                cleanupPersistenceService,
                50,
                Duration.ofMinutes(15),
                Duration.ofMinutes(10),
                Duration.ofMinutes(10),
                Duration.ofHours(6),
                Duration.ofHours(24),
                Clock.fixed(NOW, ZoneOffset.UTC),
                metrics);

        job.cleanup();

        assertThat(registry.get(DURATION_METRIC)
                        .tags(
                                "provider", "cloudinary",
                                "operation", "destroy",
                                "outcome", "error")
                        .timer()
                        .count())
                .isEqualTo(1);
        assertThat(registry.find(TIMEOUT_METRIC)
                        .tags("provider", "cloudinary", "operation", "destroy")
                        .counter())
                .isNull();
        verify(cleanupPersistenceService).releaseDeletion(
                ASSET_ID,
                claimId,
                now.plusMinutes(10));
    }

    @Test
    void uploadExceptionLogOmitsCloudinaryUrlSecretAndCauseMessage() {
        String sensitive =
                "https://api.cloudinary.com/v1_1/demo/image/upload?api_secret=never-log-this raw-image";
        ImageUploadException exception =
                new ImageUploadException("이미지 업로드에 실패했습니다.", new RuntimeException(sensitive));
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/v1/images");
        Logger logger = (Logger) LoggerFactory.getLogger(GlobalExceptionHandler.class);
        ListAppender<ILoggingEvent> appender = new ListAppender<>();
        appender.start();
        logger.addAppender(appender);

        try {
            new GlobalExceptionHandler().handleImageUpload(exception, request);
        } finally {
            logger.detachAppender(appender);
        }

        assertThat(appender.list).hasSize(1);
        ILoggingEvent event = appender.list.get(0);
        assertThat(event.getFormattedMessage())
                .contains("ImageUploadException", "RuntimeException")
                .doesNotContain("api.cloudinary.com")
                .doesNotContain("api_secret")
                .doesNotContain("never-log-this")
                .doesNotContain("raw-image");
        assertThat(event.getThrowableProxy()).isNull();
    }
}
