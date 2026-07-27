package com.fishnote.source.dto;

import java.util.List;

public record FishSourcesResponse(
        long fishId,
        String fishName,
        FishSourceSummaryResponse summary,
        List<FishClaimSourcesResponse> claims) {
}
