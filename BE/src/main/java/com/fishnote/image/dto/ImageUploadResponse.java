package com.fishnote.image.dto;

import java.time.OffsetDateTime;
import java.util.UUID;

public record ImageUploadResponse(String url, UUID assetId, OffsetDateTime expiresAt) {
}
