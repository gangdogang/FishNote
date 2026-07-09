package com.fishnote.review.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record ReviewRequest(
        String nickname,

        @Min(value = 1, message = "rating은 1 이상이어야 합니다.")
        @Max(value = 5, message = "rating은 5 이하여야 합니다.")
        Short rating,

        @NotBlank(message = "content는 필수입니다.")
        @Size(max = 1000, message = "content는 1000자 이하여야 합니다.")
        String content,

        String imageUrl,

        String password
) {
}
