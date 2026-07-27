package com.fishnote.user;

import java.net.URI;
import java.net.URISyntaxException;
import java.util.Arrays;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

@Component
public class KakaoRedirectUriPolicy {

    private static final String INVALID_REDIRECT_MESSAGE = "허용되지 않은 카카오 redirectUri입니다.";

    private final Set<String> allowedRedirectUris;

    public KakaoRedirectUriPolicy(
            @Value("${app.kakao.oauth.allowed-redirect-uris:}") String configuredRedirectUris) {
        this.allowedRedirectUris = Arrays.stream(configuredRedirectUris.split(",", -1))
                .map(String::trim)
                .filter(value -> !value.isEmpty())
                .peek(this::validateConfiguredUri)
                .collect(Collectors.toUnmodifiableSet());
    }

    public void validate(String redirectUri) {
        // Request values are deliberately not normalized: scheme, host case, port, path,
        // query, fragment, trailing slash and encoded form must all match the configured URI.
        if (redirectUri == null || !allowedRedirectUris.contains(redirectUri)) {
            throw new KakaoOAuthException(HttpStatus.BAD_REQUEST, INVALID_REDIRECT_MESSAGE);
        }
    }

    private void validateConfiguredUri(String configuredUri) {
        try {
            URI uri = new URI(configuredUri);
            boolean httpScheme = "http".equals(uri.getScheme()) || "https".equals(uri.getScheme());
            if (!httpScheme
                    || uri.getHost() == null
                    || uri.getHost().isBlank()
                    || uri.getUserInfo() != null
                    || uri.getFragment() != null) {
                throw invalidConfiguration();
            }
        } catch (URISyntaxException ex) {
            throw invalidConfiguration();
        }
    }

    private IllegalStateException invalidConfiguration() {
        return new IllegalStateException("Kakao redirect URI allowlist 설정이 올바르지 않습니다.");
    }
}
