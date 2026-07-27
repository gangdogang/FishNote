package com.fishnote.image;

import com.fishnote.review.Review;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Clock;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

@Service
public class ImageAssetAttachmentService {

    private static final String INVALID_ASSET_MESSAGE =
            "imageUrl은 이미지 업로드로 발급된 자산만 사용할 수 있습니다.";

    private final ReviewImageAssetRepository repository;
    private final Clock clock;

    @Autowired
    public ImageAssetAttachmentService(ReviewImageAssetRepository repository) {
        this(repository, Clock.systemUTC());
    }

    ImageAssetAttachmentService(ReviewImageAssetRepository repository, Clock clock) {
        this.repository = repository;
        this.clock = clock;
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public String attach(
            UUID assetId,
            String requestedUrl,
            String uploaderKey,
            Review review) {
        boolean hasUrl = StringUtils.hasText(requestedUrl);
        if (assetId == null && !hasUrl) {
            return null;
        }
        if ((hasUrl && requestedUrl.length() > 1_000)
                || !StringUtils.hasText(uploaderKey)
                || review == null
                || review.getId() == null) {
            throw invalidAsset();
        }

        ReviewImageAsset asset = assetId == null
                ? repository.findBySecureUrlForUpdate(requestedUrl).orElseThrow(ImageAssetAttachmentService::invalidAsset)
                : repository.findByIdForUpdate(assetId).orElseThrow(ImageAssetAttachmentService::invalidAsset);
        OffsetDateTime now = OffsetDateTime.ofInstant(clock.instant(), ZoneOffset.UTC);
        if (asset.getStatus() != ReviewImageAssetStatus.PENDING
                || !asset.getExpiresAt().isAfter(now)
                || !constantTimeEquals(asset.getUploaderKey(), uploaderKey)
                || (hasUrl && !requestedUrl.equals(asset.getSecureUrl()))) {
            throw invalidAsset();
        }

        asset.attach(review, now);
        repository.saveAndFlush(asset);
        return asset.getSecureUrl();
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public void queueReviewImageDeletion(Long reviewId) {
        if (reviewId == null) {
            return;
        }
        repository.findByReviewIdForUpdate(reviewId).ifPresent(asset -> {
            OffsetDateTime now = OffsetDateTime.ofInstant(clock.instant(), ZoneOffset.UTC);
            asset.markAttachedReviewDeleted(now);
            repository.saveAndFlush(asset);
        });
    }

    private static boolean constantTimeEquals(String left, String right) {
        return MessageDigest.isEqual(
                left.getBytes(StandardCharsets.UTF_8),
                right.getBytes(StandardCharsets.UTF_8));
    }

    private static IllegalArgumentException invalidAsset() {
        return new IllegalArgumentException(INVALID_ASSET_MESSAGE);
    }
}
