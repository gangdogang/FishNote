package com.fishnote.user.dto;

public record UserResponse(
        Long id,
        String email,
        String nickname
) {
}
