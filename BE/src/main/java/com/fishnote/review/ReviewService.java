package com.fishnote.review;

import com.fishnote.cache.FishStatsChangedEvent;
import com.fishnote.common.ForbiddenException;
import com.fishnote.common.NotFoundException;
import com.fishnote.common.UnauthorizedException;
import com.fishnote.fish.Fish;
import com.fishnote.fish.FishRepository;
import com.fishnote.image.ImageAssetAttachmentService;
import com.fishnote.review.dto.ReviewHelpfulResponse;
import com.fishnote.review.dto.ReviewListResponse;
import com.fishnote.review.dto.ReviewRequest;
import com.fishnote.review.dto.ReviewResponse;
import com.fishnote.user.User;
import com.fishnote.user.UserRepository;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

@Service
public class ReviewService {

    private static final int MAX_PAGE_SIZE = 100;
    private final FishRepository fishRepository;
    private final ReviewRepository reviewRepository;
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final ReviewHelpfulVoteRepository helpfulVoteRepository;
    private final ImageAssetAttachmentService imageAssetAttachmentService;
    private final FishRatingStatReader ratingStatReader;
    private final ApplicationEventPublisher eventPublisher;
    private final String helpfulVotePepper;

    public ReviewService(
            FishRepository fishRepository,
            ReviewRepository reviewRepository,
            UserRepository userRepository,
            PasswordEncoder passwordEncoder,
            ReviewHelpfulVoteRepository helpfulVoteRepository,
            ImageAssetAttachmentService imageAssetAttachmentService,
            FishRatingStatReader ratingStatReader,
            ApplicationEventPublisher eventPublisher,
            @Value("${app.helpful-vote.pepper:fishnote-helpful-vote}") String helpfulVotePepper) {
        this.fishRepository = fishRepository;
        this.reviewRepository = reviewRepository;
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.helpfulVoteRepository = helpfulVoteRepository;
        this.imageAssetAttachmentService = imageAssetAttachmentService;
        this.ratingStatReader = ratingStatReader;
        this.eventPublisher = eventPublisher;
        this.helpfulVotePepper = helpfulVotePepper;
        if ("fishnote-helpful-vote".equals(helpfulVotePepper)) {
            // 기본 pepper 사용 시 voter-key 해시가 예측 가능해짐. 운영에서는 HELPFUL_VOTE_PEPPER 필수 설정.
            org.slf4j.LoggerFactory.getLogger(ReviewService.class)
                    .warn("app.helpful-vote.pepper가 기본값입니다. 운영 환경에서는 HELPFUL_VOTE_PEPPER 환경변수를 반드시 설정하세요.");
        }
    }

    @Transactional(readOnly = true)
    public ReviewListResponse findReviews(Long fishId, int page, int size, String sort, Long userId) {
        ensureFishExists(fishId);
        // size 무제한 요청으로 인한 메모리 부담 방지
        int cappedSize = Math.min(Math.max(size, 1), MAX_PAGE_SIZE);
        Pageable pageable = PageRequest.of(Math.max(page, 0), cappedSize, reviewSort(sort));
        // 평균·개수는 개별 쿼리 대신 그룹 집계 1회로 (원거리 DB 왕복 최소화)
        FishRatingStat stat = ratingStatReader.findByFishIds(java.util.List.of(fishId)).stream()
                .findFirst()
                .orElse(null);
        long totalCount = stat == null ? 0 : stat.getReviewCount();
        return new ReviewListResponse(
                fishId,
                averageRating(stat),
                totalCount,
                stat == null ? 0 : stat.getRatingCount(),
                RatingDistribution.from(reviewRepository.countByRatingForFishId(fishId)),
                reviewRepository.findAllByFishId(fishId, pageable).stream()
                        .map(review -> toResponse(review, userId))
                        .toList(),
                pageable.getPageNumber(),
                pageable.getPageSize(),
                (long) (pageable.getPageNumber() + 1) * pageable.getPageSize() < totalCount);
    }

    @Transactional
    public ReviewResponse createReview(
            Long fishId,
            ReviewRequest request,
            Long userId,
            String imageUploaderKey) {
        Fish fish = fishRepository.findById(fishId)
                .orElseThrow(() -> new NotFoundException("횟감을 찾을 수 없습니다."));
        User user = userId == null ? null : findUser(userId);

        Review review = new Review();
        review.setFish(fish);
        review.setRating(request.rating());
        review.setContent(request.content());
        review.setImageUrl(null);
        if (user == null) {
            validateAnonymousReview(request);
            review.setNickname(request.nickname());
            review.setPasswordHash(passwordEncoder.encode(request.password()));
        } else {
            review.setUser(user);
            review.setNickname(user.getNickname());
            review.setPasswordHash(null);
        }

        Review saved = reviewRepository.saveAndFlush(review);
        saved.setImageUrl(imageAssetAttachmentService.attach(
                request.imageAssetId(),
                request.imageUrl(),
                imageUploaderKey,
                saved));
        eventPublisher.publishEvent(new FishStatsChangedEvent(fish.getId(), fish.getSlug()));
        return toResponse(saved, userId);
    }

    @Transactional
    public void deleteReview(Long reviewId, Long userId, String password) {
        Review review = reviewRepository.findById(reviewId)
                .orElseThrow(() -> new NotFoundException("후기를 찾을 수 없습니다."));
        if (isMine(review, userId)) {
            deleteReviewRecord(review);
            return;
        }

        String validPassword = validPassword(password);
        if (review.getPasswordHash() == null || !passwordEncoder.matches(validPassword, review.getPasswordHash())) {
            throw new ForbiddenException("비밀번호가 일치하지 않습니다.");
        }
        deleteReviewRecord(review);
    }

    @Transactional
    public void deleteReviewForModeration(Long reviewId) {
        Review review = reviewRepository.findById(reviewId)
                .orElseThrow(() -> new NotFoundException("후기를 찾을 수 없습니다."));
        deleteReviewRecord(review);
    }

    private void deleteReviewRecord(Review review) {
        Long fishId = review.getFish().getId();
        String fishSlug = review.getFish().getSlug();
        imageAssetAttachmentService.queueReviewImageDeletion(review.getId());
        reviewRepository.delete(review);
        eventPublisher.publishEvent(new FishStatsChangedEvent(fishId, fishSlug));
    }

    @Transactional
    public ReviewHelpfulResponse increaseHelpfulCount(Long reviewId, Long userId, String clientIp) {
        String voterKey = voterKey(userId, clientIp);
        int helpfulCount = helpfulVoteRepository
                .increaseHelpfulCountAtomically(reviewId, voterKey)
                .orElseThrow(() -> new NotFoundException("후기를 찾을 수 없습니다."));
        return new ReviewHelpfulResponse(reviewId, helpfulCount);
    }

    private String voterKey(Long userId, String clientIp) {
        String identity = userId == null ? "ip:" + clientIp : "user:" + userId;
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(digest.digest(
                    (helpfulVotePepper + ':' + identity).getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException ex) {
            throw new IllegalStateException("SHA-256 is not available", ex);
        }
    }

    private void ensureFishExists(Long fishId) {
        if (!fishRepository.existsById(fishId)) {
            throw new NotFoundException("횟감을 찾을 수 없습니다.");
        }
    }

    private User findUser(Long userId) {
        return userRepository.findById(userId)
                .orElseThrow(() -> new UnauthorizedException("인증이 필요합니다."));
    }

    private void validateAnonymousReview(ReviewRequest request) {
        if (!StringUtils.hasText(request.nickname())) {
            throw new IllegalArgumentException("nickname은 필수입니다.");
        }
        if (request.nickname().length() > 30) {
            throw new IllegalArgumentException("nickname은 30자 이하여야 합니다.");
        }
        validPassword(request.password());
    }

    private String validPassword(String password) {
        if (!StringUtils.hasText(password)) {
            throw new IllegalArgumentException("password는 필수입니다.");
        }
        if (password.length() < 4 || password.length() > 20) {
            throw new IllegalArgumentException("password는 4~20자여야 합니다.");
        }
        return password;
    }

    private ReviewResponse toResponse(Review review, Long userId) {
        return new ReviewResponse(
                review.getId(),
                review.getFish().getId(),
                review.getNickname(),
                review.getRating(),
                review.getContent(),
                review.getImageUrl(),
                review.getHelpfulCount(),
                review.getCreatedAt(),
                isMine(review, userId));
    }

    private boolean isMine(Review review, Long userId) {
        return userId != null && review.getUser() != null && userId.equals(review.getUser().getId());
    }

    private Sort reviewSort(String sort) {
        if ("latest".equalsIgnoreCase(sort)) {
            return Sort.by(Sort.Direction.DESC, "createdAt");
        }
        if ("helpful".equalsIgnoreCase(sort)) {
            return Sort.by(Sort.Order.desc("helpfulCount"), Sort.Order.desc("createdAt"));
        }
        throw new IllegalArgumentException("sort는 latest 또는 helpful 중 하나여야 합니다.");
    }

    private double averageRating(FishRatingStat stat) {
        if (stat == null || stat.getAvgRating() == null) {
            return 0.0;
        }
        return Math.round(stat.getAvgRating() * 10.0) / 10.0;
    }
}
