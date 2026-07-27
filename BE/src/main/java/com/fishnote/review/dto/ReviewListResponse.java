package com.fishnote.review.dto;

import java.util.List;
import java.util.Map;

public record ReviewListResponse(
        Long fishId,
        double avgRating,
        long totalCount,
        long ratingCount,
        Map<String, Long> ratingDistribution,
        List<ReviewResponse> reviews,
        int page,
        int size,
        boolean hasNext
) {
}
