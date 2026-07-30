package com.fishnote.admin.dto;

import com.fishnote.correction.CorrectionRequestStatus;
import jakarta.validation.constraints.NotNull;

public record AdminCorrectionUpdateRequest(
        @NotNull(message = "처리 상태는 필수입니다.")
        CorrectionRequestStatus status
) {
}
