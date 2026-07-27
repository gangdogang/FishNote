package com.fishnote.cache;

import static org.assertj.core.api.Assertions.assertThat;

import jakarta.servlet.FilterChain;
import jakarta.servlet.http.HttpServletResponse;
import java.util.stream.Stream;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;
import org.springframework.http.HttpHeaders;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

class PrivateResponseCacheFilterTest {

    private final PrivateResponseCacheFilter filter = new PrivateResponseCacheFilter();

    @ParameterizedTest
    @MethodSource("privatePaths")
    void privateAndUserSpecificPathsAreNeverStored(String path) throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", path);
        MockHttpServletResponse response = new MockHttpServletResponse();
        FilterChain chain = (ignoredRequest, chainResponse) ->
                ((HttpServletResponse) chainResponse).setStatus(200);

        filter.doFilter(request, response, chain);

        assertThat(response.getHeader(HttpHeaders.CACHE_CONTROL)).isEqualTo("private, no-store");
        assertThat(response.getHeader(HttpHeaders.PRAGMA)).isEqualTo("no-cache");
        assertThat(response.getHeader(HttpHeaders.EXPIRES)).isEqualTo("Thu, 01 Jan 1970 00:00:00 GMT");
    }

    @Test
    void publicCatalogPathIsLeftForControllerCachePolicy() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/v1/fish/7");
        MockHttpServletResponse response = new MockHttpServletResponse();

        filter.doFilter(request, response, (ignoredRequest, ignoredResponse) -> {});

        assertThat(response.getHeader(HttpHeaders.CACHE_CONTROL)).isNull();
    }

    @Test
    void errorOverridesAnyPublicCacheHeaderWithNoStore() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/v1/fish/missing");
        MockHttpServletResponse response = new MockHttpServletResponse();

        filter.doFilter(request, response, (ignoredRequest, chainResponse) -> {
            HttpServletResponse servletResponse = (HttpServletResponse) chainResponse;
            servletResponse.setHeader(HttpHeaders.CACHE_CONTROL, "public, max-age=300");
            servletResponse.setStatus(404);
        });

        assertThat(response.getStatus()).isEqualTo(404);
        assertThat(response.getHeader(HttpHeaders.CACHE_CONTROL)).isEqualTo("private, no-store");
    }

    private static Stream<String> privatePaths() {
        return Stream.of(
                "/api/v1/auth/login",
                "/api/v1/auth/me",
                "/api/v1/me/bookmarks",
                "/api/v1/fish/7/reviews",
                "/api/v1/reviews/9/helpful",
                "/api/v2/fish/7/reviews",
                "/api/v1/fish/7/corrections",
                "/api/v1/images");
    }
}
