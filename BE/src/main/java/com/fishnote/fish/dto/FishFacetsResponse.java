package com.fishnote.fish.dto;

import java.util.Map;

public record FishFacetsResponse(
        Map<String, Long> taste,
        Map<String, Long> season,
        Map<String, Long> priceLevel,
        Map<String, Long> category
) {
}
