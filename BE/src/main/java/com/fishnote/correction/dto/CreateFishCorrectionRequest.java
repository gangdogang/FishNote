package com.fishnote.correction.dto;

import com.fishnote.source.FishClaimType;
import jakarta.validation.constraints.NotNull;

public record CreateFishCorrectionRequest(
        @NotNull(message = "주장 유형은 필수입니다.") FishClaimType claimType,
        String message,
        String sourceUrl) {}
