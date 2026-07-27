package com.fishnote.common;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ReadListener;
import jakarta.servlet.ServletException;
import jakarta.servlet.ServletInputStream;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletRequestWrapper;
import jakarta.servlet.http.HttpServletResponse;
import java.io.BufferedReader;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStreamReader;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Map;
import java.util.regex.Pattern;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.annotation.Order;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Enforces small, endpoint-specific JSON body limits before MVC/Jackson deserialization.
 *
 * <p>The request is buffered only up to the configured limit plus one byte. This also covers
 * HTTP/1.1 chunked and HTTP/2 requests that do not provide a Content-Length header.</p>
 */
@Component
@Order(0)
public final class JsonRequestSizeLimitFilter extends OncePerRequestFilter {

    static final String ERROR_CODE = "PAYLOAD_TOO_LARGE";
    private static final int MAX_CONFIGURED_BYTES = 10 * 1024 * 1024;

    private static final Pattern CORRECTION_PATH =
            Pattern.compile("/api/v1/fish/[^/]+/corrections");
    private static final String TELEGRAM_PRICE_PATH =
            "/api/v1/integrations/telegram/price-updates";

    private final ObjectMapper objectMapper;
    private final int correctionMaxBytes;
    private final int telegramMaxBytes;

    public JsonRequestSizeLimitFilter(
            ObjectMapper objectMapper,
            @Value("${app.request-size.correction-json-bytes:16384}") int correctionMaxBytes,
            @Value("${app.request-size.telegram-json-bytes:65536}") int telegramMaxBytes) {
        if (correctionMaxBytes <= 0
                || telegramMaxBytes <= 0
                || correctionMaxBytes > MAX_CONFIGURED_BYTES
                || telegramMaxBytes > MAX_CONFIGURED_BYTES) {
            throw new IllegalArgumentException("JSON request size 제한은 1 byte~10 MiB여야 합니다.");
        }
        this.objectMapper = objectMapper;
        this.correctionMaxBytes = correctionMaxBytes;
        this.telegramMaxBytes = telegramMaxBytes;
    }

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain) throws ServletException, IOException {
        int maxBytes = maxBytes(request);
        if (maxBytes < 0) {
            filterChain.doFilter(request, response);
            return;
        }

        if (request.getContentLengthLong() > maxBytes) {
            reject(request, response);
            return;
        }

        byte[] body = request.getInputStream().readNBytes(maxBytes + 1);
        if (body.length > maxBytes) {
            reject(request, response);
            return;
        }
        filterChain.doFilter(new CachedBodyRequest(request, body), response);
    }

    private int maxBytes(HttpServletRequest request) {
        if (!"POST".equals(request.getMethod())) {
            return -1;
        }
        String path = request.getRequestURI();
        if (CORRECTION_PATH.matcher(path).matches()) {
            return correctionMaxBytes;
        }
        return TELEGRAM_PRICE_PATH.equals(path) ? telegramMaxBytes : -1;
    }

    private void reject(HttpServletRequest request, HttpServletResponse response) throws IOException {
        response.setStatus(HttpServletResponse.SC_REQUEST_ENTITY_TOO_LARGE);
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setCharacterEncoding("UTF-8");
        objectMapper.writeValue(response.getWriter(), new CodedErrorResponse(
                OffsetDateTime.now(ZoneOffset.UTC),
                HttpServletResponse.SC_REQUEST_ENTITY_TOO_LARGE,
                "Payload Too Large",
                ERROR_CODE,
                "요청 본문이 허용된 크기를 초과했습니다.",
                Map.of(),
                traceId(request),
                request.getRequestURI()));
    }

    private String traceId(HttpServletRequest request) {
        Object existing = request.getAttribute("traceId");
        return existing == null ? java.util.UUID.randomUUID().toString() : existing.toString();
    }

    private static final class CachedBodyRequest extends HttpServletRequestWrapper {

        private final byte[] body;

        private CachedBodyRequest(HttpServletRequest request, byte[] body) {
            super(request);
            this.body = body;
        }

        @Override
        public ServletInputStream getInputStream() {
            return new CachedBodyInputStream(body);
        }

        @Override
        public BufferedReader getReader() {
            return new BufferedReader(new InputStreamReader(
                    getInputStream(), java.nio.charset.StandardCharsets.UTF_8));
        }

        @Override
        public int getContentLength() {
            return body.length;
        }

        @Override
        public long getContentLengthLong() {
            return body.length;
        }
    }

    private static final class CachedBodyInputStream extends ServletInputStream {

        private final ByteArrayInputStream input;

        private CachedBodyInputStream(byte[] body) {
            this.input = new ByteArrayInputStream(body);
        }

        @Override
        public int read() {
            return input.read();
        }

        @Override
        public int read(byte[] bytes, int offset, int length) {
            return input.read(bytes, offset, length);
        }

        @Override
        public boolean isFinished() {
            return input.available() == 0;
        }

        @Override
        public boolean isReady() {
            return true;
        }

        @Override
        public void setReadListener(ReadListener readListener) {
            if (readListener == null) {
                throw new IllegalArgumentException("readListener는 null일 수 없습니다.");
            }
            try {
                if (isFinished()) {
                    readListener.onAllDataRead();
                } else {
                    readListener.onDataAvailable();
                }
            } catch (IOException exception) {
                readListener.onError(exception);
            }
        }
    }
}
