package com.fishnote.source.dto;

import com.fishnote.source.VerificationStatus;
import java.time.OffsetDateTime;

public record FishSourceSummaryResponse(
        VerificationStatus verificationStatus,
        OffsetDateTime lastVerifiedAt,
        int sourceCount,
        int verifiedClaimCount,
        int claimCount) {
}
