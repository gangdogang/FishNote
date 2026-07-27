package com.fishnote.image;

import com.cloudinary.Cloudinary;
import com.fishnote.observability.ExternalApiMetrics;
import java.io.IOException;
import java.time.Clock;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
@ConditionalOnProperty(
        name = "app.image.cleanup.enabled",
        havingValue = "true",
        matchIfMissing = true)
public class ImageAssetCleanupJob {

    private static final Logger log = LoggerFactory.getLogger(ImageAssetCleanupJob.class);
    private static final Map<String, Object> DESTROY_OPTIONS = Map.of(
            "resource_type", "image",
            "invalidate", true);

    private final Cloudinary cloudinary;
    private final ImageAssetCleanupPersistenceService persistenceService;
    private final int batchSize;
    private final Duration claimTimeout;
    private final Duration uploadingGrace;
    private final Duration retryBase;
    private final Duration retryMax;
    private final Duration uploadingTombstone;
    private final Clock clock;
    private final ExternalApiMetrics externalApiMetrics;

    @Autowired
    public ImageAssetCleanupJob(
            Cloudinary cloudinary,
            ImageAssetCleanupPersistenceService persistenceService,
            @Value("${app.image.cleanup.batch-size:50}") int batchSize,
            @Value("${app.image.cleanup.claim-timeout:PT15M}") Duration claimTimeout,
            @Value("${app.image.cleanup.uploading-grace:PT10M}") Duration uploadingGrace,
            @Value("${app.image.cleanup.retry-base:PT10M}") Duration retryBase,
            @Value("${app.image.cleanup.retry-max:PT6H}") Duration retryMax,
            @Value("${app.image.cleanup.uploading-tombstone:PT24H}") Duration uploadingTombstone,
            ExternalApiMetrics externalApiMetrics) {
        this(
                cloudinary,
                persistenceService,
                batchSize,
                claimTimeout,
                uploadingGrace,
                retryBase,
                retryMax,
                uploadingTombstone,
                Clock.systemUTC(),
                externalApiMetrics);
    }

    ImageAssetCleanupJob(
            Cloudinary cloudinary,
            ImageAssetCleanupPersistenceService persistenceService,
            int batchSize,
            Duration claimTimeout,
            Duration uploadingGrace,
            Duration retryBase,
            Duration retryMax,
            Duration uploadingTombstone,
            Clock clock) {
        this(
                cloudinary,
                persistenceService,
                batchSize,
                claimTimeout,
                uploadingGrace,
                retryBase,
                retryMax,
                uploadingTombstone,
                clock,
                null);
    }

    ImageAssetCleanupJob(
            Cloudinary cloudinary,
            ImageAssetCleanupPersistenceService persistenceService,
            int batchSize,
            Duration claimTimeout,
            Duration uploadingGrace,
            Duration retryBase,
            Duration retryMax,
            Duration uploadingTombstone,
            Clock clock,
            ExternalApiMetrics externalApiMetrics) {
        if (batchSize <= 0 || batchSize > 1_000) {
            throw new IllegalArgumentException("이미지 자산 정리 batch 크기는 1~1000이어야 합니다.");
        }
        if (claimTimeout == null || claimTimeout.isZero() || claimTimeout.isNegative()) {
            throw new IllegalArgumentException("이미지 자산 정리 claim timeout은 양수여야 합니다.");
        }
        if (uploadingGrace == null || uploadingGrace.isNegative()) {
            throw new IllegalArgumentException("이미지 업로드 정리 유예시간은 0 이상이어야 합니다.");
        }
        if (retryBase == null || retryBase.isZero() || retryBase.isNegative()
                || retryMax == null || retryMax.compareTo(retryBase) < 0) {
            throw new IllegalArgumentException("이미지 자산 정리 retry 범위가 올바르지 않습니다.");
        }
        if (uploadingTombstone == null
                || uploadingTombstone.isZero()
                || uploadingTombstone.isNegative()) {
            throw new IllegalArgumentException("이미지 업로드 tombstone 보존시간은 양수여야 합니다.");
        }
        this.cloudinary = cloudinary;
        this.persistenceService = persistenceService;
        this.batchSize = batchSize;
        this.claimTimeout = claimTimeout;
        this.uploadingGrace = uploadingGrace;
        this.retryBase = retryBase;
        this.retryMax = retryMax;
        this.uploadingTombstone = uploadingTombstone;
        this.clock = clock;
        this.externalApiMetrics = externalApiMetrics;
    }

    @Scheduled(
            fixedDelayString = "${app.image.cleanup.interval:PT10M}",
            initialDelayString = "${app.image.cleanup.initial-delay:PT1M}")
    public void cleanup() {
        OffsetDateTime now = OffsetDateTime.ofInstant(clock.instant(), ZoneOffset.UTC);
        java.util.List<ImageAssetCleanupPersistenceService.DeletionClaim> claims;
        try {
            claims = persistenceService.claimBatch(
                    now,
                    now.minus(uploadingGrace),
                    now.minus(claimTimeout),
                    now.plus(uploadingTombstone),
                    batchSize);
        } catch (RuntimeException ex) {
            log.warn(
                    "이미지 자산 정리 후보 선점에 실패했습니다. errorType={}",
                    ex.getClass().getSimpleName());
            return;
        }

        for (ImageAssetCleanupPersistenceService.DeletionClaim claim : claims) {
            deleteClaimedAsset(claim);
        }
    }

    private void deleteClaimedAsset(ImageAssetCleanupPersistenceService.DeletionClaim claim) {
        try {
            Map<?, ?> result = observeCloudinary(
                    "destroy",
                    () -> cloudinary.uploader().destroy(claim.publicId(), DESTROY_OPTIONS));
            Object resultValue = result == null ? null : result.get("result");
            boolean deleted = "ok".equals(resultValue);
            boolean alreadyMissing = "not found".equals(resultValue);

            // A timed-out upload may still finish remotely. Preserve its tombstone until the
            // configured safety horizon before treating not-found as terminal.
            OffsetDateTime observedAt = OffsetDateTime.ofInstant(clock.instant(), ZoneOffset.UTC);
            if (alreadyMissing
                    && claim.cleanupOriginStatus() == ReviewImageAssetStatus.UPLOADING
                    && (claim.cleanupNotFoundSafeAt() == null
                            || observedAt.isBefore(claim.cleanupNotFoundSafeAt()))) {
                releaseBestEffort(claim);
                log.info("업로드 중 이미지 자산의 삭제 확인을 유예했습니다. assetId={}", claim.assetId());
                return;
            }
            if (!deleted && !alreadyMissing) {
                releaseBestEffort(claim);
                log.warn("Cloudinary 이미지 삭제 결과를 확정할 수 없습니다. assetId={}", claim.assetId());
                return;
            }

            if (persistenceService.completeDeletion(claim.assetId(), claim.claimId())) {
                log.info("이미지 자산 정리를 완료했습니다. assetId={}", claim.assetId());
            }
        } catch (IOException | RuntimeException ex) {
            releaseBestEffort(claim);
            log.warn(
                    "이미지 자산 정리에 실패했습니다. assetId={}, errorType={}",
                    claim.assetId(),
                    ex.getClass().getSimpleName());
        }
    }

    private <T> T observeCloudinary(
            String operation,
            ExternalApiMetrics.IoSupplier<T> call) throws IOException {
        return externalApiMetrics == null
                ? call.get()
                : externalApiMetrics.recordIo("cloudinary", operation, call);
    }

    private void releaseBestEffort(ImageAssetCleanupPersistenceService.DeletionClaim claim) {
        try {
            persistenceService.releaseDeletion(
                    claim.assetId(), claim.claimId(), retryAt(claim.attempt()));
        } catch (RuntimeException ex) {
            // The claimed DELETE_PENDING row remains recoverable after claim-timeout.
            // Never log URLs or payloads.
            log.warn(
                    "이미지 자산 삭제 claim 해제에 실패했습니다. assetId={}, errorType={}",
                    claim.assetId(),
                    ex.getClass().getSimpleName());
        }
    }

    private OffsetDateTime retryAt(int attempt) {
        int doublings = Math.min(Math.max(attempt - 1, 0), 30);
        Duration delay = retryBase;
        for (int index = 0; index < doublings && delay.compareTo(retryMax) < 0; index++) {
            try {
                delay = delay.multipliedBy(2);
            } catch (ArithmeticException ex) {
                delay = retryMax;
            }
        }
        if (delay.compareTo(retryMax) > 0) {
            delay = retryMax;
        }
        return OffsetDateTime.ofInstant(clock.instant(), ZoneOffset.UTC).plus(delay);
    }
}
