package com.fishnote.common.dto;

public record CursorPageInfoResponse(
        String nextCursor,
        boolean hasNext,
        int limit
) {
}
