package com.fishnote.fish.dto;

import java.util.List;

public record FishSuggestionsResponse(List<FishSuggestionItemResponse> items) {
}
