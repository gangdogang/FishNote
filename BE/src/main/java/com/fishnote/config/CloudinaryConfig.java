package com.fishnote.config;

import com.cloudinary.Cloudinary;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.util.StringUtils;

@Configuration
public class CloudinaryConfig {

    @Bean
    public Cloudinary cloudinary(@Value("${CLOUDINARY_URL:}") String cloudinaryUrl) {
        if (!StringUtils.hasText(cloudinaryUrl)) {
            throw new IllegalStateException("CLOUDINARY_URL 환경변수가 필요합니다.");
        }
        return new Cloudinary(cloudinaryUrl);
    }
}
