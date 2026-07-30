package com.fishnote.admin.dto;

import java.time.OffsetDateTime;

public record AdminReviewResponse(
        Long id,
        Long fishId,
        String fishName,
        String nickname,
        Short rating,
        String content,
        String imageUrl,
        int helpfulCount,
        OffsetDateTime createdAt
) {
}
