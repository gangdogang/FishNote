package com.fishnote.review.query;

import com.fishnote.review.dto.ReviewResponse;
import java.time.OffsetDateTime;
import java.util.List;

public record ReviewSlice(
        List<ReviewResponse> items,
        boolean hasNext,
        Integer lastHelpfulCount,
        OffsetDateTime lastCreatedAt,
        Long lastId
) {
}
