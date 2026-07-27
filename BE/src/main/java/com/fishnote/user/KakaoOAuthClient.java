package com.fishnote.user;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.fishnote.observability.ExternalApiMetrics;
import java.time.Duration;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.util.StringUtils;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestClientResponseException;

@Component
public class KakaoOAuthClient {

    private static final String TOKEN_URL = "https://kauth.kakao.com/oauth/token";
    private static final String USER_INFO_URL = "https://kapi.kakao.com/v2/user/me";
    private static final String LOGIN_FAILED_MESSAGE = "카카오 로그인을 완료하지 못했어요. 다시 시도해 주세요.";

    private final String clientId;
    private final String clientSecret;
    private final RestClient restClient;
    private final ExternalApiMetrics externalApiMetrics;

    @Autowired
    public KakaoOAuthClient(
            @Value("${app.kakao.oauth.client-id:}") String clientId,
            @Value("${app.kakao.oauth.client-secret:}") String clientSecret,
            ExternalApiMetrics externalApiMetrics) {
        this(clientId, clientSecret, createRestClient(), externalApiMetrics);
    }

    KakaoOAuthClient(String clientId, String clientSecret, RestClient restClient) {
        this(clientId, clientSecret, restClient, null);
    }

    private KakaoOAuthClient(
            String clientId,
            String clientSecret,
            RestClient restClient,
            ExternalApiMetrics externalApiMetrics) {
        this.clientId = clientId;
        this.clientSecret = clientSecret;
        this.restClient = restClient;
        this.externalApiMetrics = externalApiMetrics;
    }

    private static RestClient createRestClient() {
        SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
        requestFactory.setConnectTimeout(Duration.ofSeconds(5));
        requestFactory.setReadTimeout(Duration.ofSeconds(5));
        return RestClient.builder().requestFactory(requestFactory).build();
    }

    public KakaoUser authenticate(String authorizationCode, String redirectUri) {
        assertConfigured();
        KakaoTokenResponse token = requestToken(authorizationCode, redirectUri);
        return requestUser(token.accessToken());
    }

    private KakaoTokenResponse requestToken(String authorizationCode, String redirectUri) {
        MultiValueMap<String, String> form = new LinkedMultiValueMap<>();
        form.add("grant_type", "authorization_code");
        form.add("client_id", clientId);
        form.add("redirect_uri", redirectUri);
        form.add("code", authorizationCode);
        form.add("client_secret", clientSecret);

        try {
            KakaoTokenResponse response = observe("token", () -> restClient.post()
                    .uri(TOKEN_URL)
                    .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                    .body(form)
                    .retrieve()
                    .body(KakaoTokenResponse.class));
            if (response == null || !StringUtils.hasText(response.accessToken())) {
                throw upstreamFailure();
            }
            return response;
        } catch (RestClientResponseException ex) {
            if (ex.getStatusCode().is4xxClientError()) {
                throw new KakaoOAuthException(HttpStatus.UNAUTHORIZED, LOGIN_FAILED_MESSAGE);
            }
            throw upstreamFailure();
        } catch (ResourceAccessException ex) {
            throw unavailable();
        } catch (RestClientException ex) {
            throw upstreamFailure();
        }
    }

    private KakaoUser requestUser(String accessToken) {
        try {
            KakaoUserResponse response = observe("user_info", () -> restClient.get()
                    .uri(USER_INFO_URL)
                    .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                    .retrieve()
                    .body(KakaoUserResponse.class));
            if (response == null || response.id() == null) {
                throw upstreamFailure();
            }

            KakaoAccount account = response.kakaoAccount();
            KakaoProfile profile = account == null ? null : account.profile();
            String nickname = profile == null ? null : profile.nickname();
            String email = account == null ? null : account.email();
            boolean verifiedEmail = account != null
                    && Boolean.TRUE.equals(account.isEmailValid())
                    && Boolean.TRUE.equals(account.isEmailVerified());
            return new KakaoUser(String.valueOf(response.id()), email, nickname, verifiedEmail);
        } catch (RestClientResponseException ex) {
            throw upstreamFailure();
        } catch (ResourceAccessException ex) {
            throw unavailable();
        } catch (RestClientException ex) {
            throw upstreamFailure();
        }
    }

    private void assertConfigured() {
        if (!StringUtils.hasText(clientId) || !StringUtils.hasText(clientSecret)) {
            throw new KakaoOAuthException(
                    HttpStatus.SERVICE_UNAVAILABLE,
                    "카카오 로그인이 아직 설정되지 않았습니다.");
        }
    }

    private <T> T observe(String operation, java.util.function.Supplier<T> call) {
        return externalApiMetrics == null
                ? call.get()
                : externalApiMetrics.record("kakao", operation, call);
    }

    private KakaoOAuthException upstreamFailure() {
        return new KakaoOAuthException(
                HttpStatus.BAD_GATEWAY,
                "카카오 로그인 서버의 응답을 확인하지 못했어요. 잠시 후 다시 시도해 주세요.");
    }

    private KakaoOAuthException unavailable() {
        return new KakaoOAuthException(
                HttpStatus.SERVICE_UNAVAILABLE,
                "카카오 로그인 서버에 연결하지 못했어요. 잠시 후 다시 시도해 주세요.");
    }

    public record KakaoUser(
            String providerUserId,
            String email,
            String nickname,
            boolean verifiedEmail
    ) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    private record KakaoTokenResponse(
            @JsonProperty("access_token") String accessToken
    ) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    private record KakaoUserResponse(
            Long id,
            @JsonProperty("kakao_account") KakaoAccount kakaoAccount
    ) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    private record KakaoAccount(
            String email,
            @JsonProperty("is_email_valid") Boolean isEmailValid,
            @JsonProperty("is_email_verified") Boolean isEmailVerified,
            KakaoProfile profile
    ) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    private record KakaoProfile(String nickname) {
    }
}
