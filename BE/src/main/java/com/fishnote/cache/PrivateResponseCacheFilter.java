package com.fishnote.cache;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpServletResponseWrapper;
import java.io.IOException;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpHeaders;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 20)
public class PrivateResponseCacheFilter extends OncePerRequestFilter {

    private static final String PRIVATE_NO_STORE = "private, no-store";

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain) throws ServletException, IOException {
        boolean privateResponse = isPrivatePath(request.getRequestURI());
        if (privateResponse) {
            applyNoStore(response);
        }
        HttpServletResponse guardedResponse = new ErrorNoStoreResponse(response);
        filterChain.doFilter(request, guardedResponse);
        if (privateResponse || response.getStatus() >= 400) {
            applyNoStore(response);
        }
    }

    static boolean isPrivatePath(String path) {
        return path.equals("/api/v1/auth")
                || path.startsWith("/api/v1/auth/")
                || path.equals("/api/v1/me")
                || path.startsWith("/api/v1/me/")
                || path.equals("/api/v1/images")
                || path.startsWith("/api/v1/images/")
                || path.startsWith("/api/v1/reviews/")
                || path.matches("/api/v1/fish/[^/]+/(reviews|corrections)(?:/.*)?")
                || path.matches("/api/v2/fish/[^/]+/reviews(?:/.*)?");
    }

    private static void applyNoStore(HttpServletResponse response) {
        response.setHeader(HttpHeaders.CACHE_CONTROL, PRIVATE_NO_STORE);
        response.setHeader(HttpHeaders.PRAGMA, "no-cache");
        response.setDateHeader(HttpHeaders.EXPIRES, 0);
    }

    private static final class ErrorNoStoreResponse extends HttpServletResponseWrapper {

        private ErrorNoStoreResponse(HttpServletResponse response) {
            super(response);
        }

        @Override
        public void setStatus(int status) {
            if (status >= 400) {
                applyNoStore((HttpServletResponse) getResponse());
            }
            super.setStatus(status);
        }

        @Override
        public void sendError(int status) throws IOException {
            applyNoStore((HttpServletResponse) getResponse());
            super.sendError(status);
        }

        @Override
        public void sendError(int status, String message) throws IOException {
            applyNoStore((HttpServletResponse) getResponse());
            super.sendError(status, message);
        }
    }
}
