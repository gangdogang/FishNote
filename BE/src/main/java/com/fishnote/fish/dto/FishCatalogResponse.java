package com.fishnote.fish.dto;

import com.fishnote.common.dto.CursorPageInfoResponse;
import java.util.List;

public record FishCatalogResponse(
        List<FishSummaryResponse> items,
        CursorPageInfoResponse pageInfo,
        FishFacetsResponse facets
) {
}
