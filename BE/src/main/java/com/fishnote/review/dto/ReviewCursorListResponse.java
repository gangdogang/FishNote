package com.fishnote.review.dto;

import com.fishnote.common.dto.CursorPageInfoResponse;
import java.util.List;

public record ReviewCursorListResponse(
        Long fishId,
        ReviewSummaryResponse summary,
        List<ReviewResponse> items,
        CursorPageInfoResponse pageInfo
) {
}
