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
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

@Service
public class ReviewService {

    private final FishRepository fishRepository;
    private final ReviewRepository reviewRepository;
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    public ReviewService(
            FishRepository fishRepository,
            ReviewRepository reviewRepository,
            UserRepository userRepository,
            PasswordEncoder passwordEncoder) {
        this.fishRepository = fishRepository;
        this.reviewRepository = reviewRepository;
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
    }

    @Transactional(readOnly = true)
    public ReviewListResponse findReviews(Long fishId, int page, int size, String sort, Long userId) {
        ensureFishExists(fishId);
        Pageable pageable = PageRequest.of(page, size, reviewSort(sort));
        // 평균·개수는 개별 쿼리 대신 그룹 집계 1회로 (원거리 DB 왕복 최소화)
        FishRatingStat stat = reviewRepository.findRatingStatsByFishIds(java.util.List.of(fishId)).stream()
                .findFirst()
                .orElse(null);
        return new ReviewListResponse(
                fishId,
                averageRating(stat),
                stat == null ? 0 : stat.getReviewCount(),
                RatingDistribution.from(reviewRepository.countByRatingForFishId(fishId)),
                reviewRepository.findAllByFishId(fishId, pageable).stream()
                        .map(review -> toResponse(review, userId))
                        .toList());
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
        review.setImageUrl(request.imageUrl());
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
    public ReviewHelpfulResponse increaseHelpfulCount(Long reviewId) {
        Review review = reviewRepository.findById(reviewId)
                .orElseThrow(() -> new NotFoundException("후기를 찾을 수 없습니다."));
        review.setHelpfulCount(review.getHelpfulCount() + 1);
        return new ReviewHelpfulResponse(review.getId(), review.getHelpfulCount());
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
