package com.fishnote.review;

import com.fishnote.common.CursorCodec;
import com.fishnote.common.InvalidCursorException;
import com.fishnote.common.NotFoundException;
import com.fishnote.common.dto.CursorPageInfoResponse;
import com.fishnote.review.dto.ReviewCursorListResponse;
import com.fishnote.review.dto.ReviewSummaryResponse;
import com.fishnote.review.query.ReviewCursor;
import com.fishnote.review.query.ReviewCursorQueryRepository;
import com.fishnote.review.query.ReviewSlice;
import java.util.Locale;
import java.util.Set;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

@Service
@Transactional(readOnly = true)
public class ReviewV2Service {

    private static final int CURSOR_VERSION = 1;
    private static final int MAX_LIMIT = 100;

    private final ReviewCursorQueryRepository reviewQueryRepository;
    private final CursorCodec cursorCodec;

    public ReviewV2Service(
            ReviewCursorQueryRepository reviewQueryRepository,
            CursorCodec cursorCodec) {
        this.reviewQueryRepository = reviewQueryRepository;
        this.cursorCodec = cursorCodec;
    }

    public ReviewCursorListResponse findReviews(
            Long fishId,
            String sort,
            int limit,
            String cursor,
            boolean includeSummary,
            Long userId) {
        if (fishId == null || fishId < 1) {
            throw new IllegalArgumentException("fishId 값이 올바르지 않습니다.");
        }
        String normalizedSort = normalizeSort(sort);
        int normalizedLimit = validateLimit(limit);
        ReviewCursor decodedCursor = decodeCursor(cursor, normalizedSort);
        ReviewSummaryResponse summary = includeSummary
                ? reviewQueryRepository.findSummary(fishId)
                        .orElseThrow(() -> new NotFoundException("횟감을 찾을 수 없습니다."))
                : null;
        ReviewSlice slice = reviewQueryRepository.findPage(
                fishId,
                normalizedSort,
                normalizedLimit,
                decodedCursor,
                userId);
        String nextCursor = slice.hasNext()
                ? cursorCodec.encode(new ReviewCursor(
                        CURSOR_VERSION,
                        normalizedSort,
                        "helpful".equals(normalizedSort) ? slice.lastHelpfulCount() : null,
                        slice.lastCreatedAt(),
                        slice.lastId()))
                : null;
        return new ReviewCursorListResponse(
                fishId,
                summary,
                slice.items(),
                new CursorPageInfoResponse(nextCursor, slice.hasNext(), normalizedLimit));
    }

    private ReviewCursor decodeCursor(String cursor, String expectedSort) {
        if (!StringUtils.hasText(cursor)) {
            return null;
        }
        ReviewCursor decoded = cursorCodec.decode(cursor, ReviewCursor.class);
        if (decoded.version() != CURSOR_VERSION
                || !expectedSort.equals(decoded.sort())
                || decoded.createdAt() == null
                || decoded.id() == null
                || decoded.id() < 1
                || ("helpful".equals(expectedSort)
                    && (decoded.helpfulCount() == null || decoded.helpfulCount() < 0))) {
            throw new InvalidCursorException();
        }
        return decoded;
    }

    private String normalizeSort(String sort) {
        String normalized = StringUtils.hasText(sort) ? sort.toLowerCase(Locale.ROOT) : "latest";
        if (!Set.of("latest", "helpful").contains(normalized)) {
            throw new IllegalArgumentException("sort는 latest 또는 helpful 중 하나여야 합니다.");
        }
        return normalized;
    }

    private int validateLimit(int limit) {
        if (limit < 1 || limit > MAX_LIMIT) {
            throw new IllegalArgumentException("limit은 1~100 사이여야 합니다.");
        }
        return limit;
    }
}
