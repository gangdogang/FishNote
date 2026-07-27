package com.fishnote.fish.dto;

import java.util.List;

public record FishAliasManifestResponse(
        int schemaVersion,
        String source,
        List<FishAliasManifestItemResponse> items) {}
