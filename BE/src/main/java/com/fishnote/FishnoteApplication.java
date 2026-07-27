package com.fishnote;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.autoconfigure.security.servlet.UserDetailsServiceAutoConfiguration;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.scheduling.annotation.EnableScheduling;

// 인증은 SecurityConfig의 stateless JWT 체인만 사용한다. 기본 in-memory 사용자를 만들면
// 운영 로그에 일회성 비밀번호가 노출되고 불필요한 보안 객체가 메모리를 차지한다.
@SpringBootApplication(exclude = UserDetailsServiceAutoConfiguration.class)
@EnableScheduling
@EnableCaching
public class FishnoteApplication {

	public static void main(String[] args) {
		SpringApplication.run(FishnoteApplication.class, args);
	}

}
