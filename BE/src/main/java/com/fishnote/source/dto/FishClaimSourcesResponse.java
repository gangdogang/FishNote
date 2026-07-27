package com.fishnote.source.dto;

import com.fishnote.source.FishClaimType;
import com.fishnote.source.VerificationStatus;
import java.time.OffsetDateTime;
import java.util.List;

public record FishClaimSourcesResponse(
        FishClaimType claimType,
        VerificationStatus verificationStatus,
        OffsetDateTime lastVerifiedAt,
        int sourceCount,
        List<FishSourceItemResponse> sources) {
}
