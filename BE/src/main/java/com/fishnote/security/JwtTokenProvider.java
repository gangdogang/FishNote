package com.fishnote.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Date;
import javax.crypto.SecretKey;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
public class JwtTokenProvider {

    private static final long EXPIRATION_DAYS = 7;

    private final SecretKey secretKey;

    public JwtTokenProvider(@Value("${JWT_SECRET:}") String jwtSecret) {
        if (jwtSecret == null || jwtSecret.isBlank()) {
            throw new IllegalStateException("JWT_SECRET 환경변수가 필요합니다.");
        }
        byte[] secretBytes = jwtSecret.getBytes(StandardCharsets.UTF_8);
        if (secretBytes.length < 32) {
            throw new IllegalStateException("JWT_SECRET은 32바이트 이상이어야 합니다.");
        }
        this.secretKey = Keys.hmacShaKeyFor(secretBytes);
    }

    public String createToken(Long userId) {
        Instant now = Instant.now();
        Instant expiration = now.plus(EXPIRATION_DAYS, ChronoUnit.DAYS);

        return Jwts.builder()
                .subject(String.valueOf(userId))
                .issuedAt(Date.from(now))
                .expiration(Date.from(expiration))
                .signWith(secretKey, Jwts.SIG.HS256)
                .compact();
    }

    public Long getUserId(String token) {
        try {
            Claims claims = Jwts.parser()
                    .verifyWith(secretKey)
                    .build()
                    .parseSignedClaims(token)
                    .getPayload();
            return Long.parseLong(claims.getSubject());
        } catch (JwtException | IllegalArgumentException ex) {
            return null;
        }
    }
}
