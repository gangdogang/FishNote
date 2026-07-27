package com.fishnote.review.query;

import java.time.OffsetDateTime;

public record ReviewCursor(
        int version,
        String sort,
        Integer helpfulCount,
        OffsetDateTime createdAt,
        Long id
) {
}
