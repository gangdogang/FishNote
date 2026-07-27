package com.fishnote.common;

import java.time.OffsetDateTime;
import java.util.Map;

public record CodedErrorResponse(
        OffsetDateTime timestamp,
        int status,
        String error,
        String code,
        String message,
        Map<String, String> fieldErrors,
        String traceId,
        String path
) {
}
