package com.fishnote.review.dto;

import java.util.Map;

public record ReviewSummaryResponse(
        Double avgRating,
        long reviewCount,
        long ratingCount,
        Map<String, Long> ratingDistribution
) {
}
