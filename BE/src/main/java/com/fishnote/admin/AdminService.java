package com.fishnote.admin;

import com.fishnote.admin.dto.AdminAuditLogResponse;
import com.fishnote.admin.dto.AdminCorrectionResponse;
import com.fishnote.admin.dto.AdminFishResponse;
import com.fishnote.admin.dto.AdminFishUpsertRequest;
import com.fishnote.admin.dto.AdminOverviewResponse;
import com.fishnote.admin.dto.AdminReviewResponse;
import com.fishnote.common.ConflictException;
import com.fishnote.common.NotFoundException;
import com.fishnote.common.UnauthorizedException;
import com.fishnote.correction.CorrectionRequestStatus;
import com.fishnote.correction.FishCorrectionRequest;
import com.fishnote.correction.FishCorrectionRequestRepository;
import com.fishnote.fish.Fish;
import com.fishnote.fish.FishAlias;
import com.fishnote.fish.FishAliasRepository;
import com.fishnote.fish.FishAliasType;
import com.fishnote.fish.FishRepository;
import com.fishnote.review.Review;
import com.fishnote.review.ReviewRepository;
import com.fishnote.review.ReviewService;
import com.fishnote.user.User;
import com.fishnote.user.UserRepository;
import java.net.URI;
import java.net.URISyntaxException;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AdminService {

    private static final int MAX_LIST_SIZE = 100;

    private final FishRepository fishRepository;
    private final FishAliasRepository fishAliasRepository;
    private final FishCorrectionRequestRepository correctionRepository;
    private final ReviewRepository reviewRepository;
    private final ReviewService reviewService;
    private final UserRepository userRepository;
    private final AdminAuditLogRepository auditLogRepository;
    private final ApplicationEventPublisher eventPublisher;

    public AdminService(
            FishRepository fishRepository,
            FishAliasRepository fishAliasRepository,
            FishCorrectionRequestRepository correctionRepository,
            ReviewRepository reviewRepository,
            ReviewService reviewService,
            UserRepository userRepository,
            AdminAuditLogRepository auditLogRepository,
            ApplicationEventPublisher eventPublisher) {
        this.fishRepository = fishRepository;
        this.fishAliasRepository = fishAliasRepository;
        this.correctionRepository = correctionRepository;
        this.reviewRepository = reviewRepository;
        this.reviewService = reviewService;
        this.userRepository = userRepository;
        this.auditLogRepository = auditLogRepository;
        this.eventPublisher = eventPublisher;
    }

    @Transactional(readOnly = true)
    public AdminOverviewResponse overview() {
        List<AdminAuditLogResponse> recentActions = auditLogRepository
                .findAllByOrderByCreatedAtDescIdDesc(PageRequest.of(0, 10))
                .stream()
                .map(this::toAuditResponse)
                .toList();
        return new AdminOverviewResponse(
                fishRepository.count(),
                reviewRepository.count(),
                correctionRepository.countByStatus(CorrectionRequestStatus.PENDING),
                userRepository.count(),
                recentActions);
    }

    @Transactional(readOnly = true)
    public List<AdminFishResponse> listFishes() {
        return fishRepository.findAllByOrderByNameAsc().stream()
                .map(this::toFishResponse)
                .toList();
    }

    @Transactional
    public AdminFishResponse createFish(Long actorUserId, AdminFishUpsertRequest request) {
        User actor = requireActor(actorUserId);
        Fish fish = new Fish();
        try {
            applyFish(fish, request);
            validateAliases(fish, request);
            replaceAliases(fish, request);
            Fish saved = fishRepository.saveAndFlush(fish);
            audit(actor, "FISH_CREATE", "FISH", saved.getId().toString(), saved.getName() + " 등록");
            eventPublisher.publishEvent(new AdminCatalogChangedEvent());
            return toFishResponse(saved);
        } catch (DataIntegrityViolationException exception) {
            throw new ConflictException("같은 이름, 슬러그 또는 별칭이 이미 등록되어 있습니다.");
        }
    }

    @Transactional
    public AdminFishResponse updateFish(
            Long actorUserId,
            Long fishId,
            AdminFishUpsertRequest request) {
        User actor = requireActor(actorUserId);
        Fish fish = fishRepository.findById(fishId)
                .orElseThrow(() -> new NotFoundException("횟감을 찾을 수 없습니다."));
        try {
            validateAliases(fish, request);
            applyFish(fish, request);
            replaceAliases(fish, request);
            Fish saved = fishRepository.saveAndFlush(fish);
            audit(actor, "FISH_UPDATE", "FISH", saved.getId().toString(), saved.getName() + " 수정");
            eventPublisher.publishEvent(new AdminCatalogChangedEvent());
            return toFishResponse(saved);
        } catch (DataIntegrityViolationException exception) {
            throw new ConflictException("같은 이름, 슬러그 또는 별칭이 이미 등록되어 있습니다.");
        }
    }

    @Transactional(readOnly = true)
    public List<AdminCorrectionResponse> listCorrections(
            CorrectionRequestStatus status,
            int limit) {
        PageRequest page = PageRequest.of(0, boundedLimit(limit));
        List<FishCorrectionRequest> requests = status == null
                ? correctionRepository.findAllByOrderByCreatedAtDescIdDesc(page)
                : correctionRepository.findAllByStatusOrderByCreatedAtDescIdDesc(status, page);
        return requests.stream().map(this::toCorrectionResponse).toList();
    }

    @Transactional
    public AdminCorrectionResponse updateCorrection(
            Long actorUserId,
            Long correctionId,
            CorrectionRequestStatus status) {
        User actor = requireActor(actorUserId);
        FishCorrectionRequest correction = correctionRepository.findById(correctionId)
                .orElseThrow(() -> new NotFoundException("오류 제보를 찾을 수 없습니다."));
        correction.updateStatus(status, OffsetDateTime.now(ZoneOffset.UTC));
        audit(
                actor,
                "CORRECTION_STATUS_UPDATE",
                "CORRECTION",
                correctionId.toString(),
                correction.getFish().getName() + " 제보를 " + status.name() + "로 변경");
        return toCorrectionResponse(correction);
    }

    @Transactional(readOnly = true)
    public List<AdminReviewResponse> listReviews(int limit) {
        return reviewRepository
                .findAllByOrderByCreatedAtDescIdDesc(PageRequest.of(0, boundedLimit(limit)))
                .stream()
                .map(this::toReviewResponse)
                .toList();
    }

    @Transactional
    public void deleteReview(Long actorUserId, Long reviewId) {
        User actor = requireActor(actorUserId);
        reviewService.deleteReviewForModeration(reviewId);
        audit(actor, "REVIEW_DELETE", "REVIEW", reviewId.toString(), "관리자 후기 삭제");
    }

    private void applyFish(Fish fish, AdminFishUpsertRequest request) {
        String name = request.name().strip();
        String slug = request.slug().strip().toLowerCase(Locale.ROOT);
        Long currentId = fish.getId() == null ? -1L : fish.getId();
        if (fishRepository.existsByNameAndIdNot(name, currentId)) {
            throw new ConflictException("같은 이름의 횟감이 이미 등록되어 있습니다.");
        }
        if (fishRepository.existsBySlugAndIdNot(slug, currentId)) {
            throw new ConflictException("같은 슬러그가 이미 등록되어 있습니다.");
        }

        fish.setName(name);
        fish.setNameEn(optional(request.nameEn()));
        fish.setSlug(slug);
        fish.setCategory(request.category());
        fish.setScientificName(optional(request.scientificName()));
        fish.setImageUrl(normalizeImageUrl(request.imageUrl()));
        fish.setTasteDesc(optional(request.tasteDesc()));
        fish.setPriceLevel(request.priceLevel());
        fish.setFeatured(request.featured());
        fish.setDescription(optional(request.description()));

        fish.getSeasonMonths().clear();
        fish.getSeasonMonths().addAll(deduplicated(request.seasonMonths()));
        fish.getTasteTags().clear();
        fish.getTasteTags().addAll(normalizedStrings(request.tasteTags(), false));
        fish.getTips().clear();
        fish.getTips().addAll(normalizedStrings(request.tips(), false));
    }

    private void validateAliases(Fish fish, AdminFishUpsertRequest request) {
        Set<String> requestedAliases = new LinkedHashSet<>(
                normalizedStrings(request.aliases(), true));
        requestedAliases.add(compactAlias(request.name()));
        for (String alias : requestedAliases) {
            fishAliasRepository.findFirstByAliasIgnoreCase(alias).ifPresent(existing -> {
                if (fish.getId() == null || !existing.getFish().getId().equals(fish.getId())) {
                    throw new ConflictException("'" + alias + "' 별칭은 다른 횟감에서 사용 중입니다.");
                }
            });
        }
    }

    private void replaceAliases(Fish fish, AdminFishUpsertRequest request) {
        List<FishAlias> previousAliases = new ArrayList<>(fish.getAliases());
        for (FishAlias alias : previousAliases) {
            fish.removeAlias(alias);
        }
        // PostgreSQL enforces a global normalized alias key. Flush orphan deletions
        // before reinserting an unchanged alias so insert-before-delete ordering
        // cannot create a transient uniqueness violation.
        if (fish.getId() != null && !previousAliases.isEmpty()) {
            fishRepository.flush();
        }
        String canonicalAlias = compactAlias(request.name());
        fish.addAlias(canonicalAlias, FishAliasType.STANDARD);
        for (String alias : normalizedStrings(request.aliases(), true)) {
            if (!alias.equalsIgnoreCase(canonicalAlias)) {
                fish.addAlias(alias, FishAliasType.MARKET);
            }
        }
    }

    private List<String> normalizedStrings(List<String> values, boolean compact) {
        if (values == null) {
            return List.of();
        }
        LinkedHashSet<String> normalized = new LinkedHashSet<>();
        for (String value : values) {
            String candidate = compact ? compactAlias(value) : value.strip();
            if (!candidate.isBlank()) {
                normalized.add(candidate);
            }
        }
        return List.copyOf(normalized);
    }

    private List<Short> deduplicated(List<Short> values) {
        return values == null ? List.of() : List.copyOf(new LinkedHashSet<>(values));
    }

    private String compactAlias(String value) {
        return value.strip().replaceAll("\\s+", "");
    }

    private String optional(String value) {
        if (value == null) {
            return null;
        }
        String normalized = value.strip();
        return normalized.isEmpty() ? null : normalized;
    }

    private String normalizeImageUrl(String value) {
        String normalized = optional(value);
        if (normalized == null || normalized.startsWith("/")) {
            return normalized;
        }
        try {
            URI uri = new URI(normalized);
            String scheme = uri.getScheme();
            if (!uri.isAbsolute()
                    || uri.isOpaque()
                    || uri.getHost() == null
                    || uri.getRawUserInfo() != null
                    || !(scheme.equalsIgnoreCase("http") || scheme.equalsIgnoreCase("https"))) {
                throw new IllegalArgumentException("이미지 URL은 절대 http/https URL 또는 /로 시작하는 경로여야 합니다.");
            }
            return scheme.toLowerCase(Locale.ROOT) + normalized.substring(scheme.length());
        } catch (URISyntaxException exception) {
            throw new IllegalArgumentException("이미지 URL 형식이 올바르지 않습니다.");
        }
    }

    private User requireActor(Long actorUserId) {
        if (actorUserId == null) {
            throw new UnauthorizedException("인증이 필요합니다.");
        }
        return userRepository.findById(actorUserId)
                .orElseThrow(() -> new UnauthorizedException("인증이 필요합니다."));
    }

    private void audit(
            User actor,
            String action,
            String targetType,
            String targetId,
            String summary) {
        auditLogRepository.save(new AdminAuditLog(actor, action, targetType, targetId, summary));
    }

    private int boundedLimit(int limit) {
        if (limit < 1 || limit > MAX_LIST_SIZE) {
            throw new IllegalArgumentException("limit은 1~100 사이여야 합니다.");
        }
        return limit;
    }

    private AdminFishResponse toFishResponse(Fish fish) {
        return new AdminFishResponse(
                fish.getId(),
                fish.getName(),
                fish.getNameEn(),
                fish.getSlug(),
                fish.getCategory(),
                fish.getScientificName(),
                fish.getImageUrl(),
                fish.getTasteDesc(),
                fish.getPriceLevel(),
                fish.isFeatured(),
                fish.getDescription(),
                fish.getSeasonMonths().stream().sorted().toList(),
                fish.getTasteTags().stream().sorted().toList(),
                List.copyOf(fish.getTips()),
                fish.getAliases().stream()
                        .filter(alias -> alias.getAliasType() == FishAliasType.MARKET)
                        .map(FishAlias::getAlias)
                        .sorted()
                        .toList(),
                fish.getUpdatedAt());
    }

    private AdminCorrectionResponse toCorrectionResponse(FishCorrectionRequest correction) {
        return new AdminCorrectionResponse(
                correction.getId(),
                correction.getFish().getId(),
                correction.getFish().getName(),
                correction.getClaimType(),
                correction.getMessage(),
                correction.getSourceUrl(),
                correction.getStatus(),
                correction.getCreatedAt(),
                correction.getResolvedAt());
    }

    private AdminReviewResponse toReviewResponse(Review review) {
        return new AdminReviewResponse(
                review.getId(),
                review.getFish().getId(),
                review.getFish().getName(),
                review.getNickname(),
                review.getRating(),
                review.getContent(),
                review.getImageUrl(),
                review.getHelpfulCount(),
                review.getCreatedAt());
    }

    private AdminAuditLogResponse toAuditResponse(AdminAuditLog log) {
        return new AdminAuditLogResponse(
                log.getId(),
                log.getActor() == null ? "삭제된 계정" : log.getActor().getNickname(),
                log.getAction(),
                log.getTargetType(),
                log.getTargetId(),
                log.getSummary(),
                log.getCreatedAt());
    }
}
