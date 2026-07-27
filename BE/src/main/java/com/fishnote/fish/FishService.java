package com.fishnote.fish;

import com.fishnote.common.NotFoundException;
import com.fishnote.fish.dto.FishAliasManifestItemResponse;
import com.fishnote.fish.dto.FishAliasManifestResponse;
import com.fishnote.fish.dto.FishDetailResponse;
import com.fishnote.fish.dto.FishFocalPointResponse;
import com.fishnote.fish.dto.FishMediaResponse;
import com.fishnote.fish.dto.FishSummaryResponse;
import com.fishnote.fish.dto.FishSuggestionCandidate;
import com.fishnote.fish.dto.FishSuggestionItemResponse;
import com.fishnote.fish.dto.FishSuggestionsResponse;
import com.fishnote.review.FishRatingStat;
import com.fishnote.review.FishRatingStatReader;
import com.fishnote.fish.query.FishDetailQueryRepository;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

@Service
@Transactional(readOnly = true)
public class FishService {

    private static final int ALIAS_MANIFEST_SCHEMA_VERSION = 1;
    private static final String ALIAS_MANIFEST_SOURCE = "fish_alias";
    private static final Set<Short> SPRING = Set.of((short) 3, (short) 4, (short) 5);
    private static final Set<Short> SUMMER = Set.of((short) 6, (short) 7, (short) 8);
    private static final Set<Short> FALL = Set.of((short) 9, (short) 10, (short) 11);
    private static final Set<Short> WINTER = Set.of((short) 12, (short) 1, (short) 2);

    private final FishRepository fishRepository;
    private final FishAliasRepository fishAliasRepository;
    private final FishRatingStatReader ratingStatReader;
    private final FishDetailQueryRepository detailQueryRepository;

    public FishService(
            FishRepository fishRepository,
            FishAliasRepository fishAliasRepository,
            FishRatingStatReader ratingStatReader,
            FishDetailQueryRepository detailQueryRepository) {
        this.fishRepository = fishRepository;
        this.fishAliasRepository = fishAliasRepository;
        this.ratingStatReader = ratingStatReader;
        this.detailQueryRepository = detailQueryRepository;
    }

    public List<FishSummaryResponse> findFishes(
            String search,
            String season,
            String taste,
            Short priceLevel,
            Short month,
            Boolean featured,
            String sort) {
        Set<Short> seasonMonths = resolveSeason(season);
        validateMonth(month);
        Comparator<FishSummaryResponse> comparator = "name".equalsIgnoreCase(sort)
                ? Comparator.comparing(FishSummaryResponse::name)
                : Comparator.comparing(FishSummaryResponse::reviewCount).reversed()
                        .thenComparing(FishSummaryResponse::avgRating, Comparator.reverseOrder())
                        .thenComparing(FishSummaryResponse::name);

        // 필터는 DB에서 수행 (전체 로드 후 인메모리 필터링 금지 — 데이터 증가 대비)
        // 컬렉션(제철 월·맛 태그)은 default_batch_fetch_size 배치 페치로 로딩된다.
        List<Specification<Fish>> specs = new ArrayList<>();
        if (StringUtils.hasText(search)) {
            specs.add(FishSpecifications.matchesSearch(search));
        }
        if (seasonMonths != null) {
            specs.add(FishSpecifications.inSeasonMonths(seasonMonths));
        }
        if (StringUtils.hasText(taste)) {
            specs.add(FishSpecifications.hasTasteTag(taste));
        }
        if (priceLevel != null) {
            specs.add(FishSpecifications.hasPriceLevel(priceLevel));
        }
        if (month != null) {
            specs.add(FishSpecifications.inMonth(month));
        }
        if (Boolean.TRUE.equals(featured)) {
            specs.add(FishSpecifications.isFeatured());
        }
        List<Fish> fishes = fishRepository.findAll(Specification.allOf(specs));

        // 생선별 별점·후기 수를 개별 쿼리 대신 한 번에 집계 (N+1 방지)
        Map<Long, FishRatingStat> stats = ratingStats(fishes.stream().map(Fish::getId).toList());

        return fishes.stream()
                .map(fish -> toSummary(fish, stats.get(fish.getId())))
                .sorted(comparator)
                .toList();
    }

    public FishDetailResponse getFish(String identifier) {
        return detailQueryRepository.findDetail(identifier)
                .orElseThrow(() -> new NotFoundException("횟감을 찾을 수 없습니다."));
    }

    public FishSuggestionsResponse suggestFishes(String query, int limit) {
        String normalized = normalizeSuggestionQuery(query);
        if (limit < 1 || limit > 20) {
            throw new IllegalArgumentException("limit은 1~20 사이여야 합니다.");
        }

        String escaped = escapeLike(normalized);
        List<FishSuggestionCandidate> candidates = fishAliasRepository.findSuggestionCandidates(
                normalized,
                "%" + escaped + "%",
                escaped + "%",
                PageRequest.of(0, limit));
        return new FishSuggestionsResponse(candidates.stream()
                .map(candidate -> new FishSuggestionItemResponse(
                        candidate.getId(),
                        candidate.getSlug(),
                        candidate.getName(),
                        candidate.getName().equals(candidate.getMatchedAlias())
                                ? null
                                : candidate.getMatchedAlias(),
                        candidate.getThumbnail()))
                .toList());
    }

    public FishAliasManifestResponse getPriceAliasManifest() {
        List<FishAliasManifestItemResponse> items = fishAliasRepository.findAllWithFish().stream()
                .map(alias -> new FishAliasManifestItemResponse(
                        alias.getAlias(),
                        alias.getFish().getName()))
                .sorted(Comparator
                        .comparingInt((FishAliasManifestItemResponse item) ->
                                item.alias().codePointCount(0, item.alias().length()))
                        .reversed()
                        .thenComparing(FishAliasManifestItemResponse::alias)
                        .thenComparing(FishAliasManifestItemResponse::canonicalFishName))
                .toList();
        return new FishAliasManifestResponse(
                ALIAS_MANIFEST_SCHEMA_VERSION,
                ALIAS_MANIFEST_SOURCE,
                items);
    }

    public List<FishSummaryResponse> summarizeFishes(List<Fish> fishes) {
        Map<Long, FishRatingStat> stats = ratingStats(fishes.stream().map(Fish::getId).toList());
        return fishes.stream()
                .map(fish -> toSummary(fish, stats.get(fish.getId())))
                .toList();
    }

    private Set<Short> resolveSeason(String season) {
        if (!StringUtils.hasText(season)) {
            return null;
        }
        return switch (season.toLowerCase(Locale.ROOT)) {
            case "spring" -> SPRING;
            case "summer" -> SUMMER;
            case "fall", "autumn" -> FALL;
            case "winter" -> WINTER;
            default -> throw new IllegalArgumentException("season은 spring/summer/fall/winter 중 하나여야 합니다.");
        };
    }

    private void validateMonth(Short month) {
        if (month != null && (month < 1 || month > 12)) {
            throw new IllegalArgumentException("month는 1~12 사이여야 합니다.");
        }
    }

    private FishSummaryResponse toSummary(Fish fish, FishRatingStat stat) {
        return new FishSummaryResponse(
                fish.getId(),
                fish.getSlug(),
                fish.getCategory(),
                fish.getName(),
                primaryMedia(fish),
                fish.getImageUrl(),
                fish.getDescription(),
                fish.getPriceLevel(),
                fish.getTasteTags().stream().sorted().toList(),
                fish.getSeasonMonths().stream().sorted().toList(),
                fish.isFeatured(),
                averageRating(stat),
                reviewCount(stat),
                ratingCount(stat));
    }

    private FishMediaResponse primaryMedia(Fish fish) {
        return fish.getImageMedia().stream()
                .filter(image -> image.getRole() == FishImageRole.PRIMARY)
                .filter(FishImage::hasResponsiveMetadata)
                .sorted(Comparator.comparingInt(FishImage::getImageOrder))
                .findFirst()
                .map(this::toMedia)
                .orElse(null);
    }

    private FishMediaResponse toMedia(FishImage image) {
        FishFocalPointResponse focalPoint = image.getFocalX() == null || image.getFocalY() == null
                ? null
                : new FishFocalPointResponse(
                        image.getFocalX().doubleValue(),
                        image.getFocalY().doubleValue());
        return new FishMediaResponse(
                image.getId().toString(),
                image.getUrl(),
                image.getWidth(),
                image.getHeight(),
                image.getAlt(),
                image.getRole(),
                image.getCredit(),
                image.getSourceUrl(),
                image.getLicense(),
                focalPoint,
                image.getBlurDataUrl());
    }

    private Map<Long, FishRatingStat> ratingStats(Collection<Long> fishIds) {
        if (fishIds.isEmpty()) {
            return Map.of();
        }
        return ratingStatReader.findByFishIds(fishIds).stream()
                .collect(Collectors.toMap(FishRatingStat::getFishId, Function.identity()));
    }

    private double averageRating(FishRatingStat stat) {
        if (stat == null || stat.getAvgRating() == null) {
            return 0.0;
        }
        return Math.round(stat.getAvgRating() * 10.0) / 10.0;
    }

    private long reviewCount(FishRatingStat stat) {
        return stat == null ? 0 : stat.getReviewCount();
    }

    private long ratingCount(FishRatingStat stat) {
        return stat == null ? 0 : stat.getRatingCount();
    }

    private String normalizeSuggestionQuery(String query) {
        String normalized = query == null
                ? ""
                : query.trim().replaceAll("\\s+", "").toLowerCase(Locale.ROOT);
        int length = normalized.codePointCount(0, normalized.length());
        if (length < 2 || length > 80) {
            throw new IllegalArgumentException("검색어는 2~80자여야 합니다.");
        }
        return normalized;
    }

    private String escapeLike(String keyword) {
        return keyword
                .replace("\\", "\\\\")
                .replace("%", "\\%")
                .replace("_", "\\_");
    }
}
