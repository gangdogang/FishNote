package com.fishnote.user.dto;

import com.fishnote.user.UserRole;

public record UserResponse(
        Long id,
        String email,
        String nickname,
        boolean hasPassword,
        UserRole role
) {
}
