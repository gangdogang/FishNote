package com.fishnote.cache;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.web.context.request.ServletWebRequest;

class PublicHttpCacheTest {

    private final PublicHttpCache httpCache = new PublicHttpCache(new ObjectMapper());

    @Test
    void listAndPriceExposeBoundedPublicCacheHeaders() {
        ResponseEntity<List<String>> list = httpCache.list(List.of("광어"));
        ResponseEntity<Map<String, Integer>> price = httpCache.price(Map.of("price", 30_000));

        assertThat(list.getHeaders().getCacheControl())
                .contains("public")
                .contains("max-age=60");
        assertThat(price.getHeaders().getCacheControl())
                .contains("public")
                .contains("max-age=180");
    }

    @Test
    void detailEtagIsDeterministicAndMatchingConditionalRequestReturnsNotModified() {
        Map<String, Object> body = Map.of("id", 7, "name", "광어");
        ServletWebRequest firstRequest = request(null);

        ResponseEntity<Map<String, Object>> first = httpCache.detail(body, firstRequest);
        ResponseEntity<Map<String, Object>> repeated = httpCache.detail(body, request(null));
        String etag = first.getHeaders().getETag();
        ResponseEntity<Map<String, Object>> conditional = httpCache.detail(body, request(etag));

        assertThat(first.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(first.getBody()).isEqualTo(body);
        assertThat(etag).isNotBlank().isEqualTo(repeated.getHeaders().getETag());
        assertThat(first.getHeaders().getCacheControl())
                .contains("public")
                .contains("max-age=300");
        assertThat(conditional.getStatusCode()).isEqualTo(HttpStatus.NOT_MODIFIED);
        assertThat(conditional.getBody()).isNull();
        assertThat(conditional.getHeaders().getETag()).isEqualTo(etag);
        assertThat(conditional.getHeaders().getCacheControl())
                .contains("public")
                .contains("max-age=300");
    }

    @Test
    void disabledFlagUsesNoStoreAndSkipsConditionalEtagHandling() {
        PublicHttpCache disabled = new PublicHttpCache(new ObjectMapper(), false);
        Map<String, Object> body = Map.of("id", 7, "name", "광어");

        ResponseEntity<Map<String, Object>> detail =
                disabled.detail(body, request("\"stale-etag\""));
        ResponseEntity<List<String>> list = disabled.list(List.of("광어"));
        ResponseEntity<Map<String, Integer>> price = disabled.price(Map.of("price", 30_000));

        assertThat(detail.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(detail.getBody()).isEqualTo(body);
        assertThat(detail.getHeaders().getETag()).isNull();
        assertThat(detail.getHeaders().getCacheControl()).isEqualTo("no-store");
        assertThat(list.getHeaders().getCacheControl()).isEqualTo("no-store");
        assertThat(price.getHeaders().getCacheControl()).isEqualTo("no-store");
    }

    private ServletWebRequest request(String ifNoneMatch) {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/v1/fish/7");
        if (ifNoneMatch != null) {
            request.addHeader(HttpHeaders.IF_NONE_MATCH, ifNoneMatch);
        }
        return new ServletWebRequest(request, new MockHttpServletResponse());
    }
}
