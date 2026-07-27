package com.fishnote.image;

import com.cloudinary.Cloudinary;
import com.fishnote.image.dto.ImageUploadResponse;
import com.fishnote.observability.ExternalApiMetrics;
import java.io.IOException;
import java.net.URI;
import java.net.URISyntaxException;
import java.time.Clock;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import java.util.function.Supplier;
import java.util.regex.Pattern;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;

@Service
public class ImageService {

    private static final Logger log = LoggerFactory.getLogger(ImageService.class);
    private static final long MAX_FILE_SIZE_BYTES = 5L * 1024 * 1024;
    private static final String UPLOAD_FOLDER = "fishnote/reviews";
    private static final String UPLOAD_ERROR_MESSAGE = "이미지 업로드에 실패했습니다.";
    private static final Pattern UPLOADER_KEY = Pattern.compile("^v1:[0-9a-f]{64}$");
    private static final Pattern URL_EXTENSION = Pattern.compile("^\\.[A-Za-z0-9]{1,10}$");

    private final Cloudinary cloudinary;
    private final ImageAssetPersistenceService assetPersistenceService;
    private final int maxDimension;
    private final long maxPixelCount;
    private final Duration pendingTtl;
    private final Clock clock;
    private final Supplier<UUID> assetIdSupplier;
    private final String cloudName;
    private final ExternalApiMetrics externalApiMetrics;

    @Autowired
    public ImageService(
            Cloudinary cloudinary,
            ImageAssetPersistenceService assetPersistenceService,
            @Value("${app.image.max-dimension:8192}") int maxDimension,
            @Value("${app.image.max-pixels:50000000}") long maxPixelCount,
            @Value("${app.image.pending-ttl:PT1H}") Duration pendingTtl,
            ExternalApiMetrics externalApiMetrics) {
        this(
                cloudinary,
                assetPersistenceService,
                maxDimension,
                maxPixelCount,
                pendingTtl,
                Clock.systemUTC(),
                UUID::randomUUID,
                externalApiMetrics);
    }

    ImageService(
            Cloudinary cloudinary,
            ImageAssetPersistenceService assetPersistenceService,
            int maxDimension,
            long maxPixelCount,
            Duration pendingTtl,
            Clock clock,
            Supplier<UUID> assetIdSupplier) {
        this(
                cloudinary,
                assetPersistenceService,
                maxDimension,
                maxPixelCount,
                pendingTtl,
                clock,
                assetIdSupplier,
                null);
    }

    ImageService(
            Cloudinary cloudinary,
            ImageAssetPersistenceService assetPersistenceService,
            int maxDimension,
            long maxPixelCount,
            Duration pendingTtl,
            Clock clock,
            Supplier<UUID> assetIdSupplier,
            ExternalApiMetrics externalApiMetrics) {
        if (maxDimension <= 0 || maxPixelCount <= 0) {
            throw new IllegalArgumentException("이미지 dimension과 pixel 제한은 양수여야 합니다.");
        }
        if (pendingTtl == null || pendingTtl.isZero() || pendingTtl.isNegative()) {
            throw new IllegalArgumentException("이미지 PENDING TTL은 양수여야 합니다.");
        }
        if (cloudinary == null
                || cloudinary.config == null
                || !StringUtils.hasText(cloudinary.config.cloudName)) {
            throw new IllegalArgumentException("Cloudinary cloud name이 필요합니다.");
        }
        this.cloudinary = cloudinary;
        this.assetPersistenceService = assetPersistenceService;
        this.maxDimension = maxDimension;
        this.maxPixelCount = maxPixelCount;
        this.pendingTtl = pendingTtl;
        this.clock = clock;
        this.assetIdSupplier = assetIdSupplier;
        this.cloudName = cloudinary.config.cloudName;
        this.externalApiMetrics = externalApiMetrics;
    }

    public ImageUploadResponse upload(MultipartFile file, String uploaderKey) {
        byte[] bytes = validate(file);
        if (!StringUtils.hasText(uploaderKey) || !UPLOADER_KEY.matcher(uploaderKey).matches()) {
            throw new IllegalArgumentException("올바른 이미지 업로더 키가 필요합니다.");
        }

        UUID assetId = assetIdSupplier.get();
        if (assetId == null) {
            throw new ImageUploadException(UPLOAD_ERROR_MESSAGE);
        }
        String publicId = UPLOAD_FOLDER + '/' + assetId;
        OffsetDateTime now = OffsetDateTime.ofInstant(clock.instant(), ZoneOffset.UTC);
        OffsetDateTime reservationExpiresAt = now.plus(pendingTtl);

        try {
            // This short transaction commits the deterministic public_id before external I/O.
            assetPersistenceService.reserve(assetId, publicId, uploaderKey, reservationExpiresAt);
        } catch (RuntimeException ex) {
            throw new ImageUploadException(UPLOAD_ERROR_MESSAGE, ex);
        }

        try {
            String url = observeCloudinary("upload", () -> validatedUploadUrl(
                    cloudinary.uploader().upload(
                            bytes,
                            Map.of(
                                    "public_id", publicId,
                                    "overwrite", false,
                                    "unique_filename", false,
                                    "resource_type", "image",
                                    // 폰 원본(수 MB)을 그대로 저장하지 않도록 업로드 시점에 축소
                                    "transformation", "c_limit,w_1600,q_auto:good")),
                    publicId));
            OffsetDateTime completedAt = OffsetDateTime.ofInstant(clock.instant(), ZoneOffset.UTC);
            OffsetDateTime pendingExpiresAt = completedAt.plus(pendingTtl);
            assetPersistenceService.completeUpload(
                    assetId, publicId, url, completedAt, pendingExpiresAt);
            return new ImageUploadResponse(url, assetId, pendingExpiresAt);
        } catch (IOException | RuntimeException ex) {
            markDeletePendingBestEffort(assetId);
            if (ex instanceof ImageUploadException imageUploadException) {
                throw imageUploadException;
            }
            throw new ImageUploadException(UPLOAD_ERROR_MESSAGE, ex);
        }
    }

    private <T> T observeCloudinary(
            String operation,
            ExternalApiMetrics.IoSupplier<T> call) throws IOException {
        return externalApiMetrics == null
                ? call.get()
                : externalApiMetrics.recordIo("cloudinary", operation, call);
    }

    private byte[] validate(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("파일은 필수입니다.");
        }
        if (file.getSize() > MAX_FILE_SIZE_BYTES) {
            throw new IllegalArgumentException("이미지는 5MB 이하만 업로드할 수 있습니다.");
        }

        String contentType = file.getContentType();
        if (!StringUtils.hasText(contentType)
                || !contentType.toLowerCase(Locale.ROOT).startsWith("image/")) {
            throw new IllegalArgumentException("이미지 파일만 업로드할 수 있습니다.");
        }

        byte[] bytes;
        try {
            bytes = file.getBytes();
        } catch (IOException ex) {
            throw new ImageUploadException(UPLOAD_ERROR_MESSAGE, ex);
        }
        // Multipart metadata may under-report size, so enforce the byte limit again after read.
        if (bytes.length == 0) {
            throw new IllegalArgumentException("파일은 필수입니다.");
        }
        if (bytes.length > MAX_FILE_SIZE_BYTES) {
            throw new IllegalArgumentException("이미지는 5MB 이하만 업로드할 수 있습니다.");
        }

        ImageMetadataInspector.ImageMetadata metadata =
                ImageMetadataInspector.inspect(bytes, contentType);
        if (metadata.width() > maxDimension || metadata.height() > maxDimension) {
            throw new IllegalArgumentException("이미지 가로와 세로는 " + maxDimension + "px 이하여야 합니다.");
        }
        long pixelCount = Math.multiplyExact((long) metadata.width(), (long) metadata.height());
        if (pixelCount > maxPixelCount) {
            throw new IllegalArgumentException("이미지 총 픽셀 수가 너무 큽니다.");
        }
        ImageMetadataInspector.verifyDecodable(bytes, metadata);
        return bytes;
    }

    private String validatedUploadUrl(Map<?, ?> uploadResult, String expectedPublicId) {
        if (!expectedPublicId.equals(uploadResult.get("public_id"))
                || !"image".equals(uploadResult.get("resource_type"))) {
            throw new ImageUploadException(UPLOAD_ERROR_MESSAGE);
        }
        Object deliveryType = uploadResult.get("type");
        if (deliveryType != null && !"upload".equals(deliveryType)) {
            throw new ImageUploadException(UPLOAD_ERROR_MESSAGE);
        }

        Object secureUrl = uploadResult.get("secure_url");
        if (!(secureUrl instanceof String url)
                || !StringUtils.hasText(url)
                || url.length() > 1_000
                || !isExpectedCloudinaryUrl(url, expectedPublicId)) {
            throw new ImageUploadException(UPLOAD_ERROR_MESSAGE);
        }
        return url;
    }

    private boolean isExpectedCloudinaryUrl(String url, String expectedPublicId) {
        try {
            URI uri = new URI(url);
            if (!"https".equalsIgnoreCase(uri.getScheme())
                    || !"res.cloudinary.com".equalsIgnoreCase(uri.getHost())
                    || uri.getUserInfo() != null
                    || uri.getPort() != -1
                    || uri.getQuery() != null
                    || uri.getFragment() != null) {
                return false;
            }
            String path = uri.getRawPath();
            String requiredPrefix = '/' + cloudName + "/image/upload/";
            String expectedAssetPath = '/' + expectedPublicId;
            int assetStart = path == null ? -1 : path.lastIndexOf(expectedAssetPath);
            if (path == null || !path.startsWith(requiredPrefix) || assetStart < requiredPrefix.length()) {
                return false;
            }
            String suffix = path.substring(assetStart + expectedAssetPath.length());
            return suffix.isEmpty() || URL_EXTENSION.matcher(suffix).matches();
        } catch (URISyntaxException ex) {
            return false;
        }
    }

    private void markDeletePendingBestEffort(UUID assetId) {
        try {
            assetPersistenceService.markDeletePending(assetId);
        } catch (RuntimeException cleanupFailure) {
            // Keep the expected public_id in the precommitted row for the scheduled cleanup retry.
            log.warn("이미지 자산 삭제 대기 전환에 실패했습니다. assetId={}", assetId);
        }
    }
}
