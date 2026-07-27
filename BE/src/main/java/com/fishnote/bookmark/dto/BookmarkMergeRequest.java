package com.fishnote.bookmark.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.List;

public record BookmarkMergeRequest(
        @NotNull(message = "fishIds는 필수입니다.")
        @Size(max = 500, message = "fishIds는 500개 이하여야 합니다.")
        List<@NotNull(message = "fishId는 필수입니다.") Long> fishIds
) {
}
