package com.fishnote.correction.dto;

import com.fishnote.correction.CorrectionRequestStatus;

public record CreateFishCorrectionResponse(
        Long id,
        CorrectionRequestStatus status) {}
