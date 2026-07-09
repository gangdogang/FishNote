package com.fishnote.user.dto;

public record AuthLoginResponse(
        String accessToken,
        String nickname
) {
}
