package com.fishnote.common;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

@Component
public class CursorCodec {

    private static final int MAX_CURSOR_LENGTH = 2048;

    private final ObjectMapper objectMapper;

    public CursorCodec(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    public String encode(Object value) {
        try {
            byte[] json = objectMapper.writeValueAsBytes(value);
            return Base64.getUrlEncoder().withoutPadding().encodeToString(json);
        } catch (JsonProcessingException ex) {
            throw new IllegalStateException("cursor를 생성할 수 없습니다.", ex);
        }
    }

    public <T> T decode(String cursor, Class<T> type) {
        if (!StringUtils.hasText(cursor) || cursor.length() > MAX_CURSOR_LENGTH) {
            throw new InvalidCursorException();
        }
        try {
            byte[] json = Base64.getUrlDecoder().decode(cursor);
            if (json.length == 0 || json.length > MAX_CURSOR_LENGTH) {
                throw new InvalidCursorException();
            }
            return objectMapper.readValue(new String(json, StandardCharsets.UTF_8), type);
        } catch (IllegalArgumentException | JsonProcessingException ex) {
            throw new InvalidCursorException();
        }
    }
}
