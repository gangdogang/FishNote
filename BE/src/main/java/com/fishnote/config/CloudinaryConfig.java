package com.fishnote.config;

import com.cloudinary.Cloudinary;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.util.StringUtils;

@Configuration
public class CloudinaryConfig {

    @Bean
    public Cloudinary cloudinary(
            @Value("${CLOUDINARY_URL:}") String cloudinaryUrl,
            @Value("${app.image.cloudinary-timeout-seconds:10}") int timeoutSeconds) {
        if (!StringUtils.hasText(cloudinaryUrl)) {
            throw new IllegalStateException("CLOUDINARY_URL 환경변수가 필요합니다.");
        }
        if (timeoutSeconds <= 0 || timeoutSeconds > 60) {
            throw new IllegalArgumentException("Cloudinary timeout은 1~60초여야 합니다.");
        }
        Cloudinary cloudinary = new Cloudinary(cloudinaryUrl);
        // cloudinary-http5 applies this value to connect, connection-request, and response timeouts.
        cloudinary.config.timeout = timeoutSeconds;
        return cloudinary;
    }
}
