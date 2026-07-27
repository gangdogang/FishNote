package com.fishnote.user.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record KakaoLoginRequest(
        @NotBlank(message = "카카오 인가 코드가 필요합니다.")
        @Size(max = 2048, message = "카카오 인가 코드가 올바르지 않습니다.")
        String code,

        @NotBlank(message = "카카오 redirectUri가 필요합니다.")
        @Size(max = 2048, message = "카카오 redirectUri가 올바르지 않습니다.")
        String redirectUri
) {
}
