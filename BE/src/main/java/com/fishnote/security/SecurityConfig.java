package com.fishnote.security;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

@Configuration
public class SecurityConfig {

    private final JwtAuthFilter jwtAuthFilter;
    private final RestAuthenticationEntryPoint authenticationEntryPoint;

    public SecurityConfig(JwtAuthFilter jwtAuthFilter, RestAuthenticationEntryPoint authenticationEntryPoint) {
        this.jwtAuthFilter = jwtAuthFilter;
        this.authenticationEntryPoint = authenticationEntryPoint;
    }

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        return http
                .csrf(AbstractHttpConfigurer::disable)
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .exceptionHandling(exception -> exception.authenticationEntryPoint(authenticationEntryPoint))
                .authorizeHttpRequests(auth -> auth
                        // 인증 필수 경로를 최상단에 고정 (아래 permitAll보다 항상 먼저 매칭되도록)
                        .requestMatchers("/api/v1/auth/me", "/api/v1/me/**").authenticated()
                        .requestMatchers(HttpMethod.OPTIONS, "/api/v1/**").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/v1/auth/**").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/v1/integrations/telegram/price-updates").permitAll()
                        // 공개 GET은 광역(/api/v1/**) 대신 필요한 경로만 명시 (신규 GET 기본 공개 방지)
                        .requestMatchers(HttpMethod.GET, "/api/v1/fish/**", "/api/v1/health").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/v1/fish/*/reviews").permitAll()
                        .requestMatchers(HttpMethod.DELETE, "/api/v1/reviews/*").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/v1/reviews/*/helpful").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/v1/images").permitAll()
                        .anyRequest().authenticated())
                .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class)
                .build();
    }
}
