package com.fishnote.source.dto;

import com.fishnote.source.FishClaimType;
import com.fishnote.source.SourceConfidence;
import java.time.LocalDate;
import java.time.OffsetDateTime;

public record FishSourceItemResponse(
        long id,
        FishClaimType claimType,
        String publisher,
        String title,
        String url,
        LocalDate publishedAt,
        OffsetDateTime verifiedAt,
        String license,
        SourceConfidence confidence) {
}
