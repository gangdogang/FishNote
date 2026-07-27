package com.fishnote.fish.dto;

public record FishSuggestionItemResponse(
        Long id,
        String slug,
        String name,
        String matchedAlias,
        String thumbnail
) {
}
