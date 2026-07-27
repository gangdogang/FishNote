package com.fishnote.user;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.notNullValue;
import static org.hamcrest.Matchers.nullValue;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import ch.qos.logback.classic.Level;
import ch.qos.logback.classic.Logger;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicBoolean;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.slf4j.LoggerFactory;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class AuthControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private UserOAuthAccountRepository oauthAccountRepository;

    @MockitoBean
    private KakaoOAuthClient kakaoOAuthClient;

    @BeforeEach
    void setUp() {
        oauthAccountRepository.deleteAll();
        userRepository.deleteAll();
    }

    @AfterEach
    void tearDown() {
        oauthAccountRepository.deleteAll();
        userRepository.deleteAll();
    }

    @Test
    void signupLoginAndMeFlowWorks() throws Exception {
        mockMvc.perform(post("/api/v1/auth/signup")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of(
                                "email", "user@example.com",
                                "password", "password123",
                                "nickname", "회러버"))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id", notNullValue()))
                .andExpect(jsonPath("$.email", is("user@example.com")))
                .andExpect(jsonPath("$.nickname", is("회러버")));

        String loginResponse = mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of(
                                "email", "user@example.com",
                                "password", "password123"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accessToken", notNullValue()))
                .andExpect(jsonPath("$.nickname", is("회러버")))
                .andReturn()
                .getResponse()
                .getContentAsString();

        String token = objectMapper.readTree(loginResponse).get("accessToken").asText();

        mockMvc.perform(get("/api/v1/auth/me")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.email", is("user@example.com")))
                .andExpect(jsonPath("$.nickname", is("회러버")));
    }

    @Test
    void signupWithInvalidRequestReturnsBadRequest() throws Exception {
        mockMvc.perform(post("/api/v1/auth/signup")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of(
                                "email", "not-email",
                                "password", "short",
                                "nickname", "회러버"))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status", is(400)))
                .andExpect(jsonPath("$.error", is("Bad Request")));
    }

    @Test
    void duplicateEmailReturnsConflict() throws Exception {
        signup("dupe@example.com", "password123", "회러버");

        mockMvc.perform(post("/api/v1/auth/signup")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of(
                                "email", "dupe@example.com",
                                "password", "password123",
                                "nickname", "다른닉"))))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.status", is(409)))
                .andExpect(jsonPath("$.message", is("이미 가입된 이메일이에요")));
    }

    @Test
    void loginFailureReturnsUnauthorized() throws Exception {
        signup("login@example.com", "password123", "회러버");

        mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of(
                                "email", "login@example.com",
                                "password", "wrong-password"))))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.status", is(401)))
                .andExpect(jsonPath("$.message", is("이메일 또는 비밀번호를 확인해 주세요")));
    }

    @Test
    void meRequiresAuthentication() throws Exception {
        mockMvc.perform(get("/api/v1/auth/me"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.status", is(401)))
                .andExpect(jsonPath("$.message", is("인증이 필요합니다.")));
    }

    @Test
    void kakaoLoginCreatesAccountAndReturnsFishnoteToken() throws Exception {
        String redirectUri = "http://localhost:5173/auth/kakao/callback";
        AtomicBoolean externalCallHadTransaction = new AtomicBoolean(true);
        when(kakaoOAuthClient.authenticate("authorization-code", redirectUri))
                .thenAnswer(invocation -> {
                    externalCallHadTransaction.set(
                            TransactionSynchronizationManager.isActualTransactionActive());
                    return new KakaoOAuthClient.KakaoUser(
                            "kakao-user-123",
                            "kakao@example.com",
                            "카카오회러버",
                            true);
                });

        String loginResponse = mockMvc.perform(post("/api/v1/auth/kakao")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of(
                                "code", "authorization-code",
                                "redirectUri", redirectUri))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accessToken", notNullValue()))
                .andExpect(jsonPath("$.nickname", is("카카오회러버")))
                .andReturn()
                .getResponse()
                .getContentAsString();

        String token = objectMapper.readTree(loginResponse).get("accessToken").asText();
        mockMvc.perform(get("/api/v1/auth/me")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.email", is("kakao@example.com")))
                .andExpect(jsonPath("$.nickname", is("카카오회러버")))
                .andExpect(jsonPath("$.hasPassword", is(false)));

        assertThat(externalCallHadTransaction.get()).isFalse();
        assertThat(userRepository.count()).isEqualTo(1);
        assertThat(oauthAccountRepository.count()).isEqualTo(1);
    }

    @Test
    void rejectsNonAllowlistedRedirectsBeforeCallingKakao() throws Exception {
        List<String> rejectedUris = List.of(
                "https://evil.example/auth/kakao/callback",
                "http://localhost:5173/auth/kakao/callback/",
                "http://localhost:5173/auth/kakao/callback?next=/",
                "http://LOCALHOST:5173/auth/kakao/callback",
                "http://127.0.0.1:5173/auth/kakao/callback",
                " http://localhost:5173/auth/kakao/callback");

        for (String rejectedUri : rejectedUris) {
            mockMvc.perform(post("/api/v1/auth/kakao")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(json(Map.of(
                                    "code", "authorization-code",
                                    "redirectUri", rejectedUri))))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.status", is(400)))
                    .andExpect(jsonPath("$.message", is("허용되지 않은 카카오 redirectUri입니다.")));
        }

        verifyNoInteractions(kakaoOAuthClient);
        assertThat(userRepository.count()).isZero();
        assertThat(oauthAccountRepository.count()).isZero();
    }

    @Test
    void keepsSensitiveFrameworkBodyLoggingDisabled() {
        Logger restClientLogger =
                (Logger) LoggerFactory.getLogger("org.springframework.web.client.DefaultRestClient");
        Logger mvcBodyLogger = (Logger) LoggerFactory.getLogger(
                "org.springframework.web.servlet.mvc.method.annotation.RequestResponseBodyMethodProcessor");

        assertThat(restClientLogger.getLevel()).isEqualTo(Level.INFO);
        assertThat(restClientLogger.isDebugEnabled()).isFalse();
        assertThat(mvcBodyLogger.getLevel()).isEqualTo(Level.INFO);
        assertThat(mvcBodyLogger.isDebugEnabled()).isFalse();
    }

    @Test
    void kakaoLoginLinksExistingEmailAccountWithoutDuplicatingUser() throws Exception {
        signup("linked@example.com", "password123", "기존닉네임");
        String redirectUri = "http://localhost:5173/auth/kakao/callback";
        when(kakaoOAuthClient.authenticate("link-code", redirectUri))
                .thenReturn(new KakaoOAuthClient.KakaoUser(
                        "kakao-user-456",
                        "linked@example.com",
                        "카카오닉네임",
                        true));

        mockMvc.perform(post("/api/v1/auth/kakao")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("code", "link-code", "redirectUri", redirectUri))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.nickname", is("기존닉네임")));

        org.assertj.core.api.Assertions.assertThat(userRepository.count()).isEqualTo(1);
        org.assertj.core.api.Assertions.assertThat(oauthAccountRepository.count()).isEqualTo(1);

        mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of(
                                "email", "linked@example.com",
                                "password", "password123"))))
                .andExpect(status().isOk());
    }

    @Test
    void kakaoLoginWithoutEmailCreatesProviderOnlyAccount() throws Exception {
        String redirectUri = "http://localhost:5173/auth/kakao/callback";
        when(kakaoOAuthClient.authenticate("no-email-code", redirectUri))
                .thenReturn(new KakaoOAuthClient.KakaoUser(
                        "kakao-user-789",
                        null,
                        "카카오사용자",
                        false));

        String loginResponse = mockMvc.perform(post("/api/v1/auth/kakao")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("code", "no-email-code", "redirectUri", redirectUri))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accessToken", notNullValue()))
                .andExpect(jsonPath("$.nickname", is("카카오사용자")))
                .andReturn()
                .getResponse()
                .getContentAsString();

        String token = objectMapper.readTree(loginResponse).get("accessToken").asText();
        mockMvc.perform(get("/api/v1/auth/me")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.email", nullValue()))
                .andExpect(jsonPath("$.nickname", is("카카오사용자")))
                .andExpect(jsonPath("$.hasPassword", is(false)));

        org.assertj.core.api.Assertions.assertThat(userRepository.count()).isEqualTo(1);
        org.assertj.core.api.Assertions.assertThat(oauthAccountRepository.count()).isEqualTo(1);
    }

    @Test
    void kakaoOnlyUserCanDeleteAccountWithoutPassword() throws Exception {
        String redirectUri = "http://localhost:5173/auth/kakao/callback";
        when(kakaoOAuthClient.authenticate("delete-kakao-code", redirectUri))
                .thenReturn(new KakaoOAuthClient.KakaoUser(
                        "kakao-user-delete",
                        "delete-kakao@example.com",
                        "탈퇴카카오",
                        true));

        String loginResponse = mockMvc.perform(post("/api/v1/auth/kakao")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of(
                                "code", "delete-kakao-code",
                                "redirectUri", redirectUri))))
                .andReturn()
                .getResponse()
                .getContentAsString();
        String token = objectMapper.readTree(loginResponse).get("accessToken").asText();

        mockMvc.perform(delete("/api/v1/auth/me")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isNoContent());

        org.assertj.core.api.Assertions.assertThat(userRepository.count()).isZero();
        org.assertj.core.api.Assertions.assertThat(oauthAccountRepository.count()).isZero();
    }

    @Test
    void authenticatedUserCanDeleteAccountWithPassword() throws Exception {
        signup("delete-account@example.com", "password123", "탈퇴회원");
        String loginResponse = mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of(
                                "email", "delete-account@example.com",
                                "password", "password123"))))
                .andExpect(status().isOk())
                .andReturn()
                .getResponse()
                .getContentAsString();
        String token = objectMapper.readTree(loginResponse).get("accessToken").asText();

        mockMvc.perform(delete("/api/v1/auth/me")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("password", "password123"))))
                .andExpect(status().isNoContent());

        mockMvc.perform(get("/api/v1/auth/me")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void invalidTokenFallsThroughForPublicApi() throws Exception {
        mockMvc.perform(get("/api/v1/fish")
                        .header("Authorization", "Bearer invalid-token"))
                .andExpect(status().isOk());
    }

    private void signup(String email, String password, String nickname) throws Exception {
        mockMvc.perform(post("/api/v1/auth/signup")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of(
                                "email", email,
                                "password", password,
                                "nickname", nickname))))
                .andExpect(status().isCreated());
    }

    private String json(Object body) throws Exception {
        return objectMapper.writeValueAsString(body);
    }
}
