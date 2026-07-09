package com.fishnote.user.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record LoginRequest(
        @NotBlank(message = "email은 필수입니다.")
        @Email(message = "email 형식이 올바르지 않습니다.")
        @Size(max = 255, message = "email은 255자 이하여야 합니다.")
        String email,

        @NotBlank(message = "password는 필수입니다.")
        @Size(min = 8, max = 64, message = "password는 8~64자여야 합니다.")
        String password
) {
}
