package com.fishnote.cache;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Duration;
import java.util.HexFormat;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.context.request.WebRequest;

@Component
public class PublicHttpCache {

    private static final CacheControl LIST_CACHE = publicCache(Duration.ofSeconds(60));
    private static final CacheControl DETAIL_CACHE = publicCache(Duration.ofSeconds(300));
    private static final CacheControl PRICE_CACHE = publicCache(Duration.ofSeconds(180));

    private final ObjectMapper objectMapper;
    private final boolean enabled;

    @Autowired
    public PublicHttpCache(
            ObjectMapper objectMapper,
            @Value("${app.cache.public.enabled:true}") boolean enabled) {
        this.objectMapper = objectMapper;
        this.enabled = enabled;
    }

    PublicHttpCache(ObjectMapper objectMapper) {
        this(objectMapper, true);
    }

    public <T> ResponseEntity<T> list(T body) {
        return ResponseEntity.ok()
                .cacheControl(enabled ? LIST_CACHE : CacheControl.noStore())
                .body(body);
    }

    public <T> ResponseEntity<T> detail(T body, WebRequest request) {
        if (!enabled) {
            return ResponseEntity.ok()
                    .cacheControl(CacheControl.noStore())
                    .body(body);
        }
        String etag = etag(body);
        if (request.checkNotModified(etag)) {
            return ResponseEntity.status(HttpStatus.NOT_MODIFIED)
                    .cacheControl(DETAIL_CACHE)
                    .eTag(etag)
                    .build();
        }
        return ResponseEntity.ok()
                .cacheControl(DETAIL_CACHE)
                .eTag(etag)
                .body(body);
    }

    public <T> ResponseEntity<T> price(T body) {
        return ResponseEntity.ok()
                .cacheControl(enabled ? PRICE_CACHE : CacheControl.noStore())
                .body(body);
    }

    private String etag(Object body) {
        try {
            byte[] serialized = objectMapper.writeValueAsBytes(body);
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(serialized);
            return '"' + HexFormat.of().formatHex(digest) + '"';
        } catch (JsonProcessingException | NoSuchAlgorithmException exception) {
            throw new IllegalStateException("공개 상세 응답의 ETag를 생성할 수 없습니다.", exception);
        }
    }

    private static CacheControl publicCache(Duration maxAge) {
        return CacheControl.maxAge(maxAge)
                .cachePublic();
    }
}
