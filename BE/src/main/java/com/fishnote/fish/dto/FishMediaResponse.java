package com.fishnote.fish.dto;

import com.fishnote.fish.FishImageRole;

public record FishMediaResponse(
        String id,
        String url,
        int width,
        int height,
        String alt,
        FishImageRole role,
        String credit,
        String sourceUrl,
        String license,
        FishFocalPointResponse focalPoint,
        String blurDataUrl) {
}
