package com.fishnote.image;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.function.Supplier;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ImageAssetCleanupPersistenceService {

    private static final int MAX_BATCH_SIZE = 1_000;

    private final ReviewImageAssetRepository repository;
    private final Supplier<UUID> claimIdSupplier;

    @Autowired
    public ImageAssetCleanupPersistenceService(ReviewImageAssetRepository repository) {
        this(repository, UUID::randomUUID);
    }

    ImageAssetCleanupPersistenceService(
            ReviewImageAssetRepository repository,
            Supplier<UUID> claimIdSupplier) {
        this.repository = repository;
        this.claimIdSupplier = claimIdSupplier;
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public List<DeletionClaim> claimBatch(
            OffsetDateTime now,
            OffsetDateTime uploadingBefore,
            OffsetDateTime staleBefore,
            OffsetDateTime uploadingNotFoundSafeAt,
            int batchSize) {
        if (now == null
                || uploadingBefore == null
                || staleBefore == null
                || uploadingNotFoundSafeAt == null) {
            throw new IllegalArgumentException("이미지 자산 정리 기준 시각이 필요합니다.");
        }
        if (batchSize <= 0 || batchSize > MAX_BATCH_SIZE) {
            throw new IllegalArgumentException("이미지 자산 정리 batch 크기는 1~1000이어야 합니다.");
        }

        List<ReviewImageAsset> candidates = repository.findCleanupCandidates(
                now, uploadingBefore, staleBefore, batchSize);
        List<ReviewImageAsset> claimedAssets = new ArrayList<>(candidates.size());
        List<DeletionClaim> claims = new ArrayList<>(candidates.size());
        for (ReviewImageAsset asset : candidates) {
            if (!isStillEligible(asset, now, uploadingBefore, staleBefore)) {
                continue;
            }
            ReviewImageAssetStatus previousStatus = asset.getStatus();
            if (previousStatus == ReviewImageAssetStatus.ATTACHED) {
                asset.markAttachedReviewDeleted(now);
            }
            UUID claimId = claimIdSupplier.get();
            if (claimId == null) {
                throw new IllegalStateException("이미지 자산 삭제 claim ID를 만들 수 없습니다.");
            }
            asset.claimDeletion(claimId, now, uploadingNotFoundSafeAt);
            claimedAssets.add(asset);
            claims.add(new DeletionClaim(
                    asset.getId(),
                    asset.getPublicId(),
                    claimId,
                    previousStatus,
                    asset.getCleanupOriginStatus(),
                    asset.getCleanupNotFoundSafeAt(),
                    asset.getCleanupAttempts()));
        }
        if (!claimedAssets.isEmpty()) {
            repository.saveAllAndFlush(claimedAssets);
        }
        return List.copyOf(claims);
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public boolean completeDeletion(UUID assetId, UUID claimId) {
        return repository.findByIdForUpdate(assetId)
                .filter(asset -> asset.isDeletionClaimedBy(claimId))
                .map(asset -> {
                    repository.delete(asset);
                    repository.flush();
                    return true;
                })
                .orElse(false);
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public boolean releaseDeletion(UUID assetId, UUID claimId, OffsetDateTime retryAt) {
        if (retryAt == null) {
            throw new IllegalArgumentException("이미지 자산 정리 재시도 시각이 필요합니다.");
        }
        return repository.findByIdForUpdate(assetId)
                .filter(asset -> asset.isDeletionClaimedBy(claimId))
                .map(asset -> {
                    asset.releaseDeletion(claimId, retryAt);
                    repository.saveAndFlush(asset);
                    return true;
                })
                .orElse(false);
    }

    private boolean isStillEligible(
            ReviewImageAsset asset,
            OffsetDateTime now,
            OffsetDateTime uploadingBefore,
            OffsetDateTime staleBefore) {
        return switch (asset.getStatus()) {
            case PENDING -> !asset.getExpiresAt().isAfter(now);
            case UPLOADING -> !asset.getExpiresAt().isAfter(uploadingBefore);
            case DELETE_PENDING -> asset.getReview() == null
                    && asset.getTastingEntry() == null
                    && (asset.getDeletionClaimId() == null
                            ? asset.getCleanupAvailableAt() == null
                                    || !asset.getCleanupAvailableAt().isAfter(now)
                            : asset.getUpdatedAt() != null
                                    && !asset.getUpdatedAt().isAfter(staleBefore));
            case ATTACHED -> asset.getReview() == null && asset.getTastingEntry() == null;
        };
    }

    public record DeletionClaim(
            UUID assetId,
            String publicId,
            UUID claimId,
            ReviewImageAssetStatus previousStatus,
            ReviewImageAssetStatus cleanupOriginStatus,
            OffsetDateTime cleanupNotFoundSafeAt,
            int attempt) {
    }
}
