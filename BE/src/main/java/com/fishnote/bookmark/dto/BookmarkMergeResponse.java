package com.fishnote.bookmark.dto;

public record BookmarkMergeResponse(
        int acceptedCount,
        int skippedCount
) {
}
