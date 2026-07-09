package com.fishnote.user;

import com.fishnote.common.ConflictException;
import com.fishnote.common.UnauthorizedException;
import com.fishnote.security.JwtTokenProvider;
import com.fishnote.user.dto.AuthLoginResponse;
import com.fishnote.user.dto.LoginRequest;
import com.fishnote.user.dto.SignupRequest;
import com.fishnote.user.dto.UserResponse;
import java.util.Locale;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuthService {

    private static final String DUPLICATE_EMAIL_MESSAGE = "이미 가입된 이메일이에요";
    private static final String LOGIN_FAILED_MESSAGE = "이메일 또는 비밀번호를 확인해 주세요";

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenProvider jwtTokenProvider;

    public AuthService(UserRepository userRepository, PasswordEncoder passwordEncoder, JwtTokenProvider jwtTokenProvider) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtTokenProvider = jwtTokenProvider;
    }

    @Transactional
    public UserResponse signup(SignupRequest request) {
        String email = normalizeEmail(request.email());
        if (userRepository.existsByEmail(email)) {
            throw new ConflictException(DUPLICATE_EMAIL_MESSAGE);
        }

        User user = new User();
        user.setEmail(email);
        user.setPasswordHash(passwordEncoder.encode(request.password()));
        user.setNickname(request.nickname().trim());

        try {
            return toResponse(userRepository.saveAndFlush(user));
        } catch (DataIntegrityViolationException ex) {
            throw new ConflictException(DUPLICATE_EMAIL_MESSAGE);
        }
    }

    @Transactional(readOnly = true)
    public AuthLoginResponse login(LoginRequest request) {
        String email = normalizeEmail(request.email());
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new UnauthorizedException(LOGIN_FAILED_MESSAGE));
        if (!passwordEncoder.matches(request.password(), user.getPasswordHash())) {
            throw new UnauthorizedException(LOGIN_FAILED_MESSAGE);
        }
        return new AuthLoginResponse(jwtTokenProvider.createToken(user.getId()), user.getNickname());
    }

    @Transactional(readOnly = true)
    public UserResponse me(Long userId) {
        return userRepository.findById(userId)
                .map(this::toResponse)
                .orElseThrow(() -> new UnauthorizedException("인증이 필요합니다."));
    }

    private UserResponse toResponse(User user) {
        return new UserResponse(user.getId(), user.getEmail(), user.getNickname());
    }

    private String normalizeEmail(String email) {
        return email.trim().toLowerCase(Locale.ROOT);
    }
}
