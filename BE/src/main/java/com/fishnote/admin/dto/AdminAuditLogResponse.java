package com.fishnote.admin.dto;

import java.time.OffsetDateTime;

public record AdminAuditLogResponse(
        Long id,
        String actorNickname,
        String action,
        String targetType,
        String targetId,
        String summary,
        OffsetDateTime createdAt
) {
}
