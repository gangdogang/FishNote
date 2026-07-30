package com.fishnote.admin.dto;

import java.util.List;

public record AdminOverviewResponse(
        long fishCount,
        long reviewCount,
        long pendingCorrectionCount,
        long userCount,
        List<AdminAuditLogResponse> recentActions
) {
}
