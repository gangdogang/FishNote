package com.fishnote.user;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.http.HttpStatus;

class KakaoRedirectUriPolicyTest {

    private static final String LOCAL_URI = "http://localhost:5173/auth/kakao/callback";
    private static final String PRODUCTION_URI = "https://fishnote.kr/auth/kakao/callback";

    @Test
    void allowsOnlyExactConfiguredStringsAndTrimsConfigurationDelimiterWhitespace() {
        KakaoRedirectUriPolicy policy =
                new KakaoRedirectUriPolicy("  " + LOCAL_URI + " , " + PRODUCTION_URI + "  ");

        assertThatCode(() -> policy.validate(LOCAL_URI)).doesNotThrowAnyException();
        assertThatCode(() -> policy.validate(PRODUCTION_URI)).doesNotThrowAnyException();
    }

    @ParameterizedTest
    @ValueSource(strings = {
        "https://evil.example/auth/kakao/callback",
        "https://fishnote.kr.evil.example/auth/kakao/callback",
        "https://fishnote.kr@evil.example/auth/kakao/callback",
        "https://FISHNOTE.kr/auth/kakao/callback",
        "http://fishnote.kr/auth/kakao/callback",
        "https://fishnote.kr:443/auth/kakao/callback",
        "https://fishnote.kr/auth/kakao/callback/",
        "https://fishnote.kr/auth/kakao/callback?next=/",
        "https://fishnote.kr/auth/kakao/callback#fragment",
        "https://fishnote.kr/auth/kakao/%63allback",
        "https://fishnote.kr/auth/../auth/kakao/callback",
        " https://fishnote.kr/auth/kakao/callback",
        "https://fishnote.kr/auth/kakao/callback ",
        "http://127.0.0.1:5173/auth/kakao/callback",
        "http://localhost:5174/auth/kakao/callback"
    })
    void rejectsEveryVariantOfAnAllowedUri(String candidate) {
        KakaoRedirectUriPolicy policy = new KakaoRedirectUriPolicy(PRODUCTION_URI);

        assertThatThrownBy(() -> policy.validate(candidate))
                .isInstanceOfSatisfying(KakaoOAuthException.class, exception -> {
                    assertThat(exception.getStatus()).isEqualTo(HttpStatus.BAD_REQUEST);
                    assertThat(exception.getMessage())
                            .isEqualTo("허용되지 않은 카카오 redirectUri입니다.")
                            .doesNotContain(candidate);
                });
    }

    @Test
    void emptyConfigurationFailsClosed() {
        KakaoRedirectUriPolicy policy = new KakaoRedirectUriPolicy("");

        assertThatThrownBy(() -> policy.validate(LOCAL_URI))
                .isInstanceOfSatisfying(KakaoOAuthException.class, exception ->
                        assertThat(exception.getStatus()).isEqualTo(HttpStatus.BAD_REQUEST));
    }

    @ParameterizedTest
    @ValueSource(strings = {
        "not-a-uri",
        "ftp://fishnote.kr/auth/kakao/callback",
        "https://user@fishnote.kr/auth/kakao/callback",
        "https://fishnote.kr/auth/kakao/callback#fragment"
    })
    void rejectsMalformedConfiguredEntriesWithoutEchoingThem(String configuredUri) {
        assertThatThrownBy(() -> new KakaoRedirectUriPolicy(configuredUri))
                .isInstanceOfSatisfying(IllegalStateException.class, exception ->
                        assertThat(exception.getMessage())
                                .isEqualTo("Kakao redirect URI allowlist 설정이 올바르지 않습니다.")
                                .doesNotContain(configuredUri));
    }
}
