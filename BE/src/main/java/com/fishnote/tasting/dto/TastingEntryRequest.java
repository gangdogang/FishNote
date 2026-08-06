package com.fishnote.tasting.dto;

import com.fishnote.tasting.TastingPreparation;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PastOrPresent;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;
import java.util.UUID;

public record TastingEntryRequest(
        @NotNull Long fishId,
        @NotNull @PastOrPresent LocalDate tastedOn,
        @Min(1) @Max(5) Short rating,
        @NotNull TastingPreparation preparation,
        @Size(max = 100) String placeName,
        @Size(max = 500) String note,
        @Size(max = 1_000) String imageUrl,
        UUID imageAssetId) {
}
