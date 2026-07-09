package com.fishnote.bookmark.dto;

import jakarta.validation.constraints.NotNull;
import java.util.List;

public record BookmarkMergeRequest(
        @NotNull(message = "fishIds는 필수입니다.")
        List<@NotNull(message = "fishId는 필수입니다.") Long> fishIds
) {
}
