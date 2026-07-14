package com.fishnote.review;

import com.fishnote.common.ForbiddenException;
import com.fishnote.common.NotFoundException;
import com.fishnote.common.UnauthorizedException;
import com.fishnote.fish.Fish;
import com.fishnote.fish.FishRepository;
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
    // 서비스가 발급한 Cloudinary URL만 허용 (임의 외부 URL·javascript: 스킴 저장 방지)
    private static final java.util.regex.Pattern ALLOWED_IMAGE_URL =
            java.util.regex.Pattern.compile("^https://res\\.cloudinary\\.com/[\\w\\-./%]+$");

    private final FishRepository fishRepository;
    private final ReviewRepository reviewRepository;
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final ReviewHelpfulVoteRepository helpfulVoteRepository;
    private final String helpfulVotePepper;

    public ReviewService(
            FishRepository fishRepository,
            ReviewRepository reviewRepository,
            UserRepository userRepository,
            PasswordEncoder passwordEncoder,
            ReviewHelpfulVoteRepository helpfulVoteRepository,
            @Value("${app.helpful-vote.pepper:fishnote-helpful-vote}") String helpfulVotePepper) {
        this.fishRepository = fishRepository;
        this.reviewRepository = reviewRepository;
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.helpfulVoteRepository = helpfulVoteRepository;
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
        FishRatingStat stat = reviewRepository.findRatingStatsByFishIds(java.util.List.of(fishId)).stream()
                .findFirst()
                .orElse(null);
        long totalCount = stat == null ? 0 : stat.getReviewCount();
        return new ReviewListResponse(
                fishId,
                averageRating(stat),
                totalCount,
                RatingDistribution.from(reviewRepository.countByRatingForFishId(fishId)),
                reviewRepository.findAllByFishId(fishId, pageable).stream()
                        .map(review -> toResponse(review, userId))
                        .toList(),
                pageable.getPageNumber(),
                pageable.getPageSize(),
                (long) (pageable.getPageNumber() + 1) * pageable.getPageSize() < totalCount);
    }

    @Transactional
    public ReviewResponse createReview(Long fishId, ReviewRequest request, Long userId) {
        Fish fish = fishRepository.findById(fishId)
                .orElseThrow(() -> new NotFoundException("생선을 찾을 수 없습니다."));
        User user = userId == null ? null : findUser(userId);

        Review review = new Review();
        review.setFish(fish);
        review.setRating(request.rating());
        review.setContent(request.content());
        review.setImageUrl(validImageUrl(request.imageUrl()));
        if (user == null) {
            validateAnonymousReview(request);
            review.setNickname(request.nickname());
            review.setPasswordHash(passwordEncoder.encode(request.password()));
        } else {
            review.setUser(user);
            review.setNickname(user.getNickname());
            review.setPasswordHash(null);
        }

        return toResponse(reviewRepository.save(review), userId);
    }

    @Transactional
    public void deleteReview(Long reviewId, Long userId, String password) {
        Review review = reviewRepository.findById(reviewId)
                .orElseThrow(() -> new NotFoundException("후기를 찾을 수 없습니다."));
        if (isMine(review, userId)) {
            reviewRepository.delete(review);
            return;
        }

        String validPassword = validPassword(password);
        if (review.getPasswordHash() == null || !passwordEncoder.matches(validPassword, review.getPasswordHash())) {
            throw new ForbiddenException("비밀번호가 일치하지 않습니다.");
        }
        reviewRepository.delete(review);
    }

    @Transactional
    public ReviewHelpfulResponse increaseHelpfulCount(Long reviewId, Long userId, String clientIp) {
        Review review = reviewRepository.findById(reviewId)
                .orElseThrow(() -> new NotFoundException("후기를 찾을 수 없습니다."));
        String voterKey = voterKey(userId, clientIp);
        if (helpfulVoteRepository.existsByReviewIdAndVoterKey(reviewId, voterKey)) {
            return new ReviewHelpfulResponse(reviewId, review.getHelpfulCount());
        }

        helpfulVoteRepository.save(new ReviewHelpfulVote(review, voterKey));
        // read-modify-write 대신 원자적 UPDATE로 동시 요청 시 증가분 유실 방지
        if (reviewRepository.incrementHelpfulCount(reviewId) == 0) {
            throw new NotFoundException("후기를 찾을 수 없습니다.");
        }
        int helpfulCount = reviewRepository.findHelpfulCountById(reviewId).orElse(0);
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
            throw new NotFoundException("생선을 찾을 수 없습니다.");
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

    private String validImageUrl(String imageUrl) {
        if (!StringUtils.hasText(imageUrl)) {
            return null;
        }
        if (imageUrl.length() > 500 || !ALLOWED_IMAGE_URL.matcher(imageUrl).matches()) {
            throw new IllegalArgumentException("imageUrl은 이미지 업로드로 발급된 URL만 사용할 수 있습니다.");
        }
        return imageUrl;
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
