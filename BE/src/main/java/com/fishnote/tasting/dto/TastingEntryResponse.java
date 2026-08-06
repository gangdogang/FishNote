package com.fishnote.tasting.dto;

import com.fishnote.tasting.TastingPreparation;
import java.time.LocalDate;
import java.time.OffsetDateTime;

public record TastingEntryResponse(
        Long id,
        Long fishId,
        String fishSlug,
        String fishName,
        String fishImageUrl,
        LocalDate tastedOn,
        Short rating,
        TastingPreparation preparation,
        String placeName,
        String note,
        String imageUrl,
        OffsetDateTime createdAt,
        OffsetDateTime updatedAt) {
}
