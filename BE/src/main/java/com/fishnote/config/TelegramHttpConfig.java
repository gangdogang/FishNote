package com.fishnote.config;

import java.time.Duration;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.RestTemplate;

@Configuration
public class TelegramHttpConfig {

    @Bean("telegramRestTemplate")
    public RestTemplate telegramRestTemplate(
            @Value("${app.telegram.connect-timeout:PT2S}") Duration connectTimeout,
            @Value("${app.telegram.read-timeout:PT3S}") Duration readTimeout) {
        validateTimeout("connect", connectTimeout);
        validateTimeout("read", readTimeout);

        SimpleClientHttpRequestFactory requestFactory =
                new SimpleClientHttpRequestFactory();
        requestFactory.setConnectTimeout(connectTimeout);
        requestFactory.setReadTimeout(readTimeout);
        return new RestTemplate(requestFactory);
    }

    private void validateTimeout(String name, Duration timeout) {
        if (timeout == null
                || timeout.compareTo(Duration.ofMillis(1)) < 0
                || timeout.compareTo(Duration.ofSeconds(30)) > 0) {
            throw new IllegalArgumentException(
                    "Telegram " + name + " timeout은 0초 초과 30초 이하여야 합니다.");
        }
    }
}
