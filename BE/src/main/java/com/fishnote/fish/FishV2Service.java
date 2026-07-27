package com.fishnote.fish;

import com.fishnote.common.CursorCodec;
import com.fishnote.common.InvalidCursorException;
import com.fishnote.common.dto.CursorPageInfoResponse;
import com.fishnote.fish.dto.FishCatalogResponse;
import com.fishnote.fish.dto.FishDetailResponse;
import com.fishnote.fish.query.FishCatalogCursor;
import com.fishnote.fish.query.FishCatalogQuery;
import com.fishnote.fish.query.FishCatalogQueryRepository;
import com.fishnote.fish.query.FishCatalogSlice;
import com.fishnote.fish.query.FishDetailQueryRepository;
import com.fishnote.common.NotFoundException;
import java.util.Locale;
import java.util.Set;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

@Service
@Transactional(readOnly = true)
public class FishV2Service {

    private static final int CURSOR_VERSION = 1;
    private static final int MAX_LIMIT = 100;
    private static final Set<Short> SPRING = Set.of((short) 3, (short) 4, (short) 5);
    private static final Set<Short> SUMMER = Set.of((short) 6, (short) 7, (short) 8);
    private static final Set<Short> FALL = Set.of((short) 9, (short) 10, (short) 11);
    private static final Set<Short> WINTER = Set.of((short) 12, (short) 1, (short) 2);

    private final FishCatalogQueryRepository catalogRepository;
    private final CursorCodec cursorCodec;
    private final FishDetailQueryRepository detailRepository;

    public FishV2Service(
            FishCatalogQueryRepository catalogRepository,
            CursorCodec cursorCodec,
            FishDetailQueryRepository detailRepository) {
        this.catalogRepository = catalogRepository;
        this.cursorCodec = cursorCodec;
        this.detailRepository = detailRepository;
    }

    public FishDetailResponse getFish(String identifier) {
        return detailRepository.findDetail(identifier)
                .orElseThrow(() -> new NotFoundException("횟감을 찾을 수 없습니다."));
    }

    public FishCatalogResponse findFishes(
            String search,
            String season,
            String taste,
            Short priceLevel,
            Short month,
            Boolean featured,
            String category,
            String sort,
            int limit,
            String cursor) {
        String normalizedSort = normalizeSort(sort);
        int normalizedLimit = validateLimit(limit);
        validateMonth(month);
        validatePriceLevel(priceLevel);
        FishCatalogCursor decodedCursor = decodeCursor(cursor, normalizedSort);
        FishCatalogQuery query = new FishCatalogQuery(
                search,
                resolveSeason(season),
                taste,
                priceLevel,
                month,
                featured,
                resolveCategory(category),
                normalizedSort,
                normalizedLimit,
                decodedCursor);
        FishCatalogSlice slice = catalogRepository.findPage(query);
        String nextCursor = slice.hasNext()
                ? cursorCodec.encode(new FishCatalogCursor(
                        CURSOR_VERSION,
                        normalizedSort,
                        slice.lastReviewCount(),
                        slice.lastAvgRating(),
                        slice.lastName(),
                        slice.lastId()))
                : null;
        return new FishCatalogResponse(
                slice.items(),
                new CursorPageInfoResponse(nextCursor, slice.hasNext(), normalizedLimit),
                slice.facets());
    }

    private FishCatalogCursor decodeCursor(String cursor, String expectedSort) {
        if (!StringUtils.hasText(cursor)) {
            return null;
        }
        FishCatalogCursor decoded = cursorCodec.decode(cursor, FishCatalogCursor.class);
        if (decoded.version() != CURSOR_VERSION
                || !expectedSort.equals(decoded.sort())
                || decoded.name() == null
                || decoded.id() == null
                || decoded.id() < 1
                || ("popular".equals(expectedSort)
                    && (decoded.reviewCount() == null
                        || decoded.reviewCount() < 0
                        || decoded.avgRating() == null
                        || decoded.avgRating().signum() < 0))) {
            throw new InvalidCursorException();
        }
        return decoded;
    }

    private String normalizeSort(String sort) {
        String normalized = StringUtils.hasText(sort) ? sort.toLowerCase(Locale.ROOT) : "popular";
        if (!Set.of("popular", "name").contains(normalized)) {
            throw new IllegalArgumentException("sort는 popular 또는 name 중 하나여야 합니다.");
        }
        return normalized;
    }

    private int validateLimit(int limit) {
        if (limit < 1 || limit > MAX_LIMIT) {
            throw new IllegalArgumentException("limit은 1~100 사이여야 합니다.");
        }
        return limit;
    }

    private void validateMonth(Short month) {
        if (month != null && (month < 1 || month > 12)) {
            throw new IllegalArgumentException("month는 1~12 사이여야 합니다.");
        }
    }

    private void validatePriceLevel(Short priceLevel) {
        if (priceLevel != null && (priceLevel < 1 || priceLevel > 3)) {
            throw new IllegalArgumentException("priceLevel은 1~3 사이여야 합니다.");
        }
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

    private FishCategory resolveCategory(String category) {
        if (!StringUtils.hasText(category)) {
            return null;
        }
        try {
            return FishCategory.valueOf(category.toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException ex) {
            throw new IllegalArgumentException("category 값이 올바르지 않습니다.");
        }
    }
}
