package com.fishnote.admin;

import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.notNullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.options;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fishnote.fish.FishRepository;
import com.fishnote.security.JwtTokenProvider;
import com.fishnote.user.User;
import com.fishnote.user.UserRepository;
import com.fishnote.user.UserRole;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class AdminControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private FishRepository fishRepository;

    @Autowired
    private AdminAuditLogRepository auditLogRepository;

    @Autowired
    private JwtTokenProvider jwtTokenProvider;

    private String adminToken;
    private String userToken;

    @BeforeEach
    void setUp() {
        auditLogRepository.deleteAll();
        fishRepository.deleteAll();
        userRepository.deleteAll();
        adminToken = tokenFor("admin@example.com", "운영자", UserRole.ADMIN);
        userToken = tokenFor("user@example.com", "일반회원", UserRole.USER);
    }

    @AfterEach
    void tearDown() {
        auditLogRepository.deleteAll();
        fishRepository.deleteAll();
        userRepository.deleteAll();
    }

    @Test
    void adminEndpointsRequireAuthenticationAndAdminRole() throws Exception {
        mockMvc.perform(get("/api/v1/admin/overview"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code", is("UNAUTHORIZED")));

        mockMvc.perform(get("/api/v1/admin/overview")
                        .header("Authorization", "Bearer " + userToken))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code", is("FORBIDDEN")))
                .andExpect(jsonPath("$.message", is("관리자 권한이 필요합니다.")));

        mockMvc.perform(get("/api/v1/admin/overview")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.userCount", is(2)))
                .andExpect(jsonPath("$.fishCount", is(0)));
    }

    @Test
    void adminEndpointAllowsCorsPreflightWithoutAuthentication() throws Exception {
        mockMvc.perform(options("/api/v1/admin/overview")
                        .header(HttpHeaders.ORIGIN, "http://localhost:5173")
                        .header(HttpHeaders.ACCESS_CONTROL_REQUEST_METHOD, "GET"))
                .andExpect(status().isOk())
                .andExpect(header().string(
                        HttpHeaders.ACCESS_CONTROL_ALLOW_ORIGIN,
                        "http://localhost:5173"));
    }

    @Test
    void adminCanCreateAndUpdateFishAndActionsAreAudited() throws Exception {
        String createResponse = mockMvc.perform(post("/api/v1/admin/fishes")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "name": "한치",
                                  "nameEn": "Spear squid",
                                  "slug": "hanchi",
                                  "category": "CEPHALOPOD",
                                  "scientificName": null,
                                  "imageUrl": "/fish/hanchi.jpg",
                                  "tasteDesc": "단맛이 좋습니다.",
                                  "priceLevel": 2,
                                  "featured": false,
                                  "description": "여름철 별미",
                                  "seasonMonths": [6, 7, 8],
                                  "tasteTags": ["달큰한", "쫄깃한"],
                                  "tips": ["차갑게 먹어요."],
                                  "aliases": ["창오징어"]
                                }
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id", notNullValue()))
                .andExpect(jsonPath("$.name", is("한치")))
                .andExpect(jsonPath("$.aliases", hasSize(1)))
                .andReturn()
                .getResponse()
                .getContentAsString();

        long fishId = new com.fasterxml.jackson.databind.ObjectMapper()
                .readTree(createResponse)
                .get("id")
                .asLong();

        mockMvc.perform(put("/api/v1/admin/fishes/{fishId}", fishId)
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "name": "한치",
                                  "nameEn": "Spear squid",
                                  "slug": "hanchi",
                                  "category": "CEPHALOPOD",
                                  "scientificName": null,
                                  "imageUrl": "/fish/hanchi.jpg",
                                  "tasteDesc": "단맛이 좋습니다.",
                                  "priceLevel": 2,
                                  "featured": true,
                                  "description": "여름철 별미",
                                  "seasonMonths": [6, 7, 8],
                                  "tasteTags": ["달큰한", "쫄깃한"],
                                  "tips": ["차갑게 먹어요."],
                                  "aliases": ["창오징어"]
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.featured", is(true)));

        mockMvc.perform(get("/api/v1/admin/overview")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.fishCount", is(1)))
                .andExpect(jsonPath("$.recentActions", hasSize(2)));
    }

    private String tokenFor(String email, String nickname, UserRole role) {
        User user = new User();
        user.setEmail(email);
        user.setNickname(nickname);
        user.setRole(role);
        User saved = userRepository.saveAndFlush(user);
        return jwtTokenProvider.createToken(saved.getId());
    }
}
