package com.fishnote.image;

import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.util.HexFormat;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

@Component
public class ImageUploaderKeyFactory {

    private static final String ALGORITHM = "HmacSHA256";
    private static final String KEY_PREFIX = "v1:";
    private static final int MINIMUM_SECRET_BYTES = 32;

    private final SecretKeySpec secretKey;

    public ImageUploaderKeyFactory(
            @Value("${app.image.uploader-key-secret:}") String secret) {
        byte[] secretBytes = secret == null
                ? new byte[0]
                : secret.getBytes(StandardCharsets.UTF_8);
        if (secretBytes.length < MINIMUM_SECRET_BYTES) {
            throw new IllegalStateException(
                    "IMAGE_UPLOADER_KEY_SECRET은 32바이트 이상이어야 합니다.");
        }
        this.secretKey = new SecretKeySpec(secretBytes, ALGORITHM);
    }

    public String forUser(Long userId) {
        if (userId == null || userId <= 0) {
            throw new IllegalArgumentException("올바른 사용자 식별자가 필요합니다.");
        }
        return create("user", Long.toString(userId));
    }

    public String forAnonymous(String clientIp) {
        if (!StringUtils.hasText(clientIp) || "unknown".equalsIgnoreCase(clientIp)) {
            throw new IllegalArgumentException("클라이언트 주소를 확인할 수 없습니다.");
        }
        return create("anonymous-ip", clientIp);
    }

    private String create(String kind, String identity) {
        try {
            Mac mac = Mac.getInstance(ALGORITHM);
            mac.init(secretKey);
            byte[] digest = mac.doFinal(
                    ("fishnote:image-uploader:v1:" + kind + ':' + identity)
                            .getBytes(StandardCharsets.UTF_8));
            return KEY_PREFIX + HexFormat.of().formatHex(digest);
        } catch (GeneralSecurityException ex) {
            throw new IllegalStateException("이미지 업로더 키를 생성할 수 없습니다.", ex);
        }
    }
}
