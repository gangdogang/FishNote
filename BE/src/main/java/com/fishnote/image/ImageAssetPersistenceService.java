package com.fishnote.image;

import java.time.OffsetDateTime;
import java.time.Clock;
import java.time.Duration;
import java.time.ZoneOffset;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ImageAssetPersistenceService {

    private final ReviewImageAssetRepository repository;
    private final Clock clock;
    private final Duration uploadingTombstone;

    @Autowired
    public ImageAssetPersistenceService(
            ReviewImageAssetRepository repository,
            @org.springframework.beans.factory.annotation.Value(
                    "${app.image.cleanup.uploading-tombstone:PT24H}")
                    Duration uploadingTombstone) {
        this(repository, Clock.systemUTC(), uploadingTombstone);
    }

    ImageAssetPersistenceService(ReviewImageAssetRepository repository, Clock clock) {
        this(repository, clock, Duration.ofHours(24));
    }

    ImageAssetPersistenceService(
            ReviewImageAssetRepository repository,
            Clock clock,
            Duration uploadingTombstone) {
        if (uploadingTombstone == null
                || uploadingTombstone.isZero()
                || uploadingTombstone.isNegative()) {
            throw new IllegalArgumentException("이미지 업로드 tombstone 보존시간은 양수여야 합니다.");
        }
        this.repository = repository;
        this.clock = clock;
        this.uploadingTombstone = uploadingTombstone;
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void reserve(
            UUID assetId,
            String publicId,
            String uploaderKey,
            OffsetDateTime expiresAt) {
        repository.saveAndFlush(
                new ReviewImageAsset(assetId, publicId, uploaderKey, expiresAt));
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void completeUpload(
            UUID assetId,
            String expectedPublicId,
            String secureUrl,
            OffsetDateTime completedAt,
            OffsetDateTime pendingExpiresAt) {
        ReviewImageAsset asset = repository.findByIdForUpdate(assetId)
                .orElseThrow(() -> new IllegalStateException("예약된 이미지 자산을 찾을 수 없습니다."));
        if (!asset.getPublicId().equals(expectedPublicId)) {
            throw new IllegalStateException("예약된 이미지 public_id가 일치하지 않습니다.");
        }
        asset.completeUpload(secureUrl, completedAt, pendingExpiresAt);
        repository.saveAndFlush(asset);
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void markDeletePending(UUID assetId) {
        repository.findByIdForUpdate(assetId).ifPresent(asset -> {
            if (asset.getDeletionClaimId() != null) {
                return;
            }
            OffsetDateTime now = OffsetDateTime.ofInstant(clock.instant(), ZoneOffset.UTC);
            OffsetDateTime notFoundSafeAt = asset.getStatus() == ReviewImageAssetStatus.UPLOADING
                    ? now.plus(uploadingTombstone)
                    : null;
            asset.markDeletePending(now, notFoundSafeAt);
            repository.saveAndFlush(asset);
        });
    }
}
