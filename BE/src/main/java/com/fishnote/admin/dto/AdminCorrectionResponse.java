package com.fishnote.admin.dto;

import com.fishnote.correction.CorrectionRequestStatus;
import com.fishnote.source.FishClaimType;
import java.time.OffsetDateTime;

public record AdminCorrectionResponse(
        Long id,
        Long fishId,
        String fishName,
        FishClaimType claimType,
        String message,
        String sourceUrl,
        CorrectionRequestStatus status,
        OffsetDateTime createdAt,
        OffsetDateTime resolvedAt
) {
}
