package com.fishnote.home;

import com.fishnote.fish.dto.FishFacetsResponse;
import com.fishnote.fish.dto.FishSummaryResponse;
import java.time.Instant;
import java.util.List;

public record HomeResponse(
        short month,
        Instant generatedAt,
        List<FishSummaryResponse> seasonal,
        List<FishSummaryResponse> featured,
        List<FishSummaryResponse> catalog,
        FishFacetsResponse facets) {
}
