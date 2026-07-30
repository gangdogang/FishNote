package com.fishnote.common;

import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.head;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fishnote.security.JwtTokenProvider;
import com.fishnote.user.User;
import com.fishnote.user.UserRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest(properties = "app.rate-limit.enabled=true")
@AutoConfigureMockMvc
@ActiveProfiles("test")
class RateLimitSecurityIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JwtTokenProvider jwtTokenProvider;

    @Autowired
    private UserRepository userRepository;

    @Test
    void anonymousHeadSuggestionsIsPublicAndCorsAllowed() throws Exception {
        mockMvc.perform(head("/api/v1/fish/suggestions")
                        .param("q", "도미")
                        .header(HttpHeaders.ORIGIN, "http://localhost:5173"))
                .andExpect(status().isOk())
                .andExpect(header().string(
                        HttpHeaders.ACCESS_CONTROL_ALLOW_ORIGIN,
                        "http://localhost:5173"));
    }

    @Test
    void malformedControllerRequestsAreLimitedOnceAndExposeCorsBackoffHeaders() throws Exception {
        for (int index = 0; index < 10; index++) {
            mockMvc.perform(post("/api/v1/fish/not-a-number/reviews")
                            .header(HttpHeaders.ORIGIN, "http://localhost:5173")
                            .header("X-Forwarded-For", "203.0.113." + index)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{}"))
                    .andExpect(status().isBadRequest());
        }

        mockMvc.perform(post("/api/v1/fish/not-a-number/reviews")
                        .header(HttpHeaders.ORIGIN, "http://localhost:5173")
                        .header("X-Forwarded-For", "192.0.2.250")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isTooManyRequests())
                .andExpect(header().string(
                        HttpHeaders.ACCESS_CONTROL_ALLOW_ORIGIN,
                        "http://localhost:5173"))
                .andExpect(header().string(
                        HttpHeaders.ACCESS_CONTROL_EXPOSE_HEADERS,
                        containsString(HttpHeaders.RETRY_AFTER)))
                .andExpect(header().string(
                        HttpHeaders.ACCESS_CONTROL_EXPOSE_HEADERS,
                        containsString(RateLimitFilter.RESET_HEADER)))
                .andExpect(header().exists(HttpHeaders.RETRY_AFTER))
                .andExpect(header().exists(RateLimitFilter.RESET_HEADER))
                .andExpect(jsonPath("$.code").value(RateLimitFilter.ERROR_CODE));
    }

    @Test
    void jwtAuthenticatedRequestsShareAUserBucketAcrossRemoteAddressChanges() throws Exception {
        User user = new User();
        user.setNickname("레이트리밋 테스트");
        User savedUser = userRepository.saveAndFlush(user);

        try {
            String token = jwtTokenProvider.createToken(savedUser.getId());

            for (int index = 0; index < 10; index++) {
                String remoteAddress = "198.51.100." + index;
                mockMvc.perform(delete("/api/v1/reviews/not-a-number")
                                .header(HttpHeaders.AUTHORIZATION, "Bearer " + token)
                                .with(request -> {
                                    request.setRemoteAddr(remoteAddress);
                                    return request;
                                }))
                        .andExpect(status().isBadRequest());
            }

            mockMvc.perform(delete("/api/v1/reviews/not-a-number")
                            .header(HttpHeaders.AUTHORIZATION, "Bearer " + token)
                            .with(request -> {
                                request.setRemoteAddr("203.0.113.99");
                                return request;
                            }))
                    .andExpect(status().isTooManyRequests())
                    .andExpect(jsonPath("$.code").value(RateLimitFilter.ERROR_CODE));
        } finally {
            userRepository.deleteById(savedUser.getId());
        }
    }

    @Test
    void anonymousCorrectionsAreLimitedAfterFiveAttemptsWithCorsBackoffMetadata() throws Exception {
        String payload = """
                {"claimType":"SEASON","message":"정정 제보"}
                """;

        for (int index = 0; index < 5; index++) {
            mockMvc.perform(post("/api/v1/fish/999999/corrections")
                            .with(request -> {
                                request.setRemoteAddr("198.51.100.77");
                                return request;
                            })
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(payload))
                    .andExpect(status().isNotFound());
        }

        mockMvc.perform(post("/api/v1/fish/999999/corrections")
                        .with(request -> {
                            request.setRemoteAddr("198.51.100.77");
                            return request;
                        })
                        .header(HttpHeaders.ORIGIN, "http://localhost:5173")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payload))
                .andExpect(status().isTooManyRequests())
                .andExpect(header().string(
                        HttpHeaders.ACCESS_CONTROL_ALLOW_ORIGIN,
                        "http://localhost:5173"))
                .andExpect(header().string(
                        HttpHeaders.ACCESS_CONTROL_EXPOSE_HEADERS,
                        containsString(HttpHeaders.RETRY_AFTER)))
                .andExpect(header().string(
                        HttpHeaders.ACCESS_CONTROL_EXPOSE_HEADERS,
                        containsString(RateLimitFilter.RESET_HEADER)))
                .andExpect(header().exists(HttpHeaders.RETRY_AFTER))
                .andExpect(header().exists(RateLimitFilter.RESET_HEADER))
                .andExpect(jsonPath("$.status").value(429))
                .andExpect(jsonPath("$.path").value("/api/v1/fish/999999/corrections"))
                .andExpect(jsonPath("$.code").value(RateLimitFilter.ERROR_CODE));
    }
}
