package com.fishnote.user;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.client.ExpectedCount.once;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.content;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.header;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withBadRequest;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withServerError;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

class KakaoOAuthClientTest {

    private static final String TOKEN_URL = "https://kauth.kakao.com/oauth/token";
    private static final String USER_INFO_URL = "https://kapi.kakao.com/v2/user/me";

    @Test
    void exchangesAuthorizationCodeAndMapsVerifiedUser() {
        RestClient.Builder builder = RestClient.builder();
        MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
        KakaoOAuthClient client = new KakaoOAuthClient("rest-key", "client-secret", builder.build());

        server.expect(once(), requestTo(TOKEN_URL))
                .andExpect(method(HttpMethod.POST))
                .andExpect(content().string(containsString("client_id=rest-key")))
                .andExpect(content().string(containsString("client_secret=client-secret")))
                .andExpect(content().string(containsString("code=authorization-code")))
                .andRespond(withSuccess("""
                        {"access_token":"kakao-access-token","token_type":"bearer"}
                        """, MediaType.APPLICATION_JSON));

        server.expect(once(), requestTo(USER_INFO_URL))
                .andExpect(method(HttpMethod.GET))
                .andExpect(header("Authorization", "Bearer kakao-access-token"))
                .andRespond(withSuccess("""
                        {
                          "id": 123456789,
                          "kakao_account": {
                            "email": "user@example.com",
                            "is_email_valid": true,
                            "is_email_verified": true,
                            "profile": {"nickname": "카카오회러버"}
                          }
                        }
                        """, MediaType.APPLICATION_JSON));

        KakaoOAuthClient.KakaoUser user = client.authenticate(
                "authorization-code",
                "http://localhost:5173/auth/kakao/callback");

        assertThat(user.providerUserId()).isEqualTo("123456789");
        assertThat(user.email()).isEqualTo("user@example.com");
        assertThat(user.nickname()).isEqualTo("카카오회러버");
        assertThat(user.verifiedEmail()).isTrue();
        server.verify();
    }

    @Test
    void invalidAuthorizationCodeReturnsUnauthorizedError() {
        RestClient.Builder builder = RestClient.builder();
        MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
        KakaoOAuthClient client = new KakaoOAuthClient("rest-key", "client-secret", builder.build());

        server.expect(once(), requestTo(TOKEN_URL))
                .andRespond(withBadRequest());

        assertThatThrownBy(() -> client.authenticate(
                "invalid-code",
                "http://localhost:5173/auth/kakao/callback"))
                .isInstanceOfSatisfying(KakaoOAuthException.class, exception ->
                        assertThat(exception.getStatus()).isEqualTo(HttpStatus.UNAUTHORIZED));
        server.verify();
    }

    @Test
    void malformedTokenResponseBecomesSanitizedBadGateway() {
        RestClient.Builder builder = RestClient.builder();
        MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
        KakaoOAuthClient client = new KakaoOAuthClient("rest-key", "client-secret", builder.build());

        server.expect(once(), requestTo(TOKEN_URL))
                .andRespond(withSuccess(
                        "{\"access_token\":\"sensitive-token\"",
                        MediaType.APPLICATION_JSON));

        assertThatThrownBy(() -> client.authenticate("sensitive-code", "https://safe.example/callback"))
                .isInstanceOfSatisfying(KakaoOAuthException.class, exception -> {
                    assertThat(exception.getStatus()).isEqualTo(HttpStatus.BAD_GATEWAY);
                    assertThat(exception.getMessage())
                            .doesNotContain("sensitive-token", "sensitive-code", "client-secret");
                });
        server.verify();
    }

    @Test
    void malformedUserResponseBecomesSanitizedBadGateway() {
        RestClient.Builder builder = RestClient.builder();
        MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
        KakaoOAuthClient client = new KakaoOAuthClient("rest-key", "client-secret", builder.build());

        server.expect(once(), requestTo(TOKEN_URL))
                .andRespond(withSuccess(
                        "{\"access_token\":\"sensitive-token\"}",
                        MediaType.APPLICATION_JSON));
        server.expect(once(), requestTo(USER_INFO_URL))
                .andRespond(withSuccess(
                        "{\"id\":\"not-a-number\",\"email\":\"sensitive@example.com\"}",
                        MediaType.APPLICATION_JSON));

        assertThatThrownBy(() -> client.authenticate("sensitive-code", "https://safe.example/callback"))
                .isInstanceOfSatisfying(KakaoOAuthException.class, exception -> {
                    assertThat(exception.getStatus()).isEqualTo(HttpStatus.BAD_GATEWAY);
                    assertThat(exception.getMessage())
                            .doesNotContain("sensitive-token", "sensitive-code", "sensitive@example.com");
                });
        server.verify();
    }

    @Test
    void upstreamServerErrorBecomesBadGateway() {
        RestClient.Builder builder = RestClient.builder();
        MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
        KakaoOAuthClient client = new KakaoOAuthClient("rest-key", "client-secret", builder.build());

        server.expect(once(), requestTo(TOKEN_URL)).andRespond(withServerError());

        assertThatThrownBy(() -> client.authenticate("code", "https://safe.example/callback"))
                .isInstanceOfSatisfying(KakaoOAuthException.class, exception ->
                        assertThat(exception.getStatus()).isEqualTo(HttpStatus.BAD_GATEWAY));
        server.verify();
    }
}
