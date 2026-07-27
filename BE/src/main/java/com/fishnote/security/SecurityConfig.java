package com.fishnote.security;

import com.fishnote.common.RateLimitFilter;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

@Configuration
public class SecurityConfig {

    private final JwtAuthFilter jwtAuthFilter;
    private final RateLimitFilter rateLimitFilter;
    private final RestAuthenticationEntryPoint authenticationEntryPoint;

    public SecurityConfig(
            JwtAuthFilter jwtAuthFilter,
            RateLimitFilter rateLimitFilter,
            RestAuthenticationEntryPoint authenticationEntryPoint) {
        this.jwtAuthFilter = jwtAuthFilter;
        this.rateLimitFilter = rateLimitFilter;
        this.authenticationEntryPoint = authenticationEntryPoint;
    }

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        return http
                // This service authenticates API requests with an Authorization bearer
                // token, not ambient cookies. Keep those stateless API routes exempt
                // while retaining CSRF protection for any future non-API browser route.
                .csrf(csrf -> csrf.ignoringRequestMatchers("/api/**", "/actuator/**"))
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .exceptionHandling(exception -> exception.authenticationEntryPoint(authenticationEntryPoint))
                .authorizeHttpRequests(auth -> auth
                        // 인증 필수 경로를 최상단에 고정 (아래 permitAll보다 항상 먼저 매칭되도록)
                        .requestMatchers("/api/v1/auth/me", "/api/v1/me/**").authenticated()
                        .requestMatchers(HttpMethod.OPTIONS, "/api/v1/**", "/api/v2/**").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/v1/auth/**").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/v1/integrations/telegram/price-updates").permitAll()
                        // 공개 GET은 광역(/api/v1/**) 대신 필요한 경로만 명시 (신규 GET 기본 공개 방지)
                        .requestMatchers(HttpMethod.GET, "/api/v1/fish/**", "/api/v1/home", "/api/v1/health").permitAll()
                        .requestMatchers(HttpMethod.HEAD, "/api/v1/fish/**", "/api/v1/home", "/api/v1/health").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/v2/fish/**").permitAll()
                        .requestMatchers(HttpMethod.HEAD, "/api/v2/fish/**").permitAll()
                        .requestMatchers(HttpMethod.GET, "/actuator/health", "/actuator/health/**").permitAll()
                        .requestMatchers(HttpMethod.HEAD, "/actuator/health", "/actuator/health/**").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/v1/fish/*/reviews").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/v1/fish/*/corrections").permitAll()
                        .requestMatchers(HttpMethod.DELETE, "/api/v1/reviews/*").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/v1/reviews/*/helpful").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/v1/images").permitAll()
                        .anyRequest().authenticated())
                .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class)
                .addFilterAfter(rateLimitFilter, JwtAuthFilter.class)
                .build();
    }

    /** Prevent Spring Boot from also registering the filter outside the security chain. */
    @Bean
    public FilterRegistrationBean<RateLimitFilter> rateLimitFilterRegistration(
            RateLimitFilter filter) {
        FilterRegistrationBean<RateLimitFilter> registration = new FilterRegistrationBean<>(filter);
        registration.setEnabled(false);
        return registration;
    }
}
