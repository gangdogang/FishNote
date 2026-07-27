package com.fishnote.user;

import com.fishnote.common.ConflictException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * Transaction boundary around Kakao account persistence.
 *
 * <p>The authorization-code exchange is completed by {@link AuthService} before this coordinator
 * is called. A failed unique race is allowed to roll its transaction back completely, then the
 * winning provider account is re-read in a fresh transaction.</p>
 */
@Service
public class KakaoAccountService {

    private static final String PROVIDER_OWNER_CONFLICT_MESSAGE =
            "이 이메일 계정에는 다른 카카오 계정이 연결되어 있습니다.";

    private final KakaoAccountPersistenceService persistenceService;

    public KakaoAccountService(KakaoAccountPersistenceService persistenceService) {
        this.persistenceService = persistenceService;
    }

    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    public KakaoAccount login(KakaoOAuthClient.KakaoUser kakaoUser) {
        try {
            return persistenceService.loginInNewTransaction(kakaoUser);
        } catch (DataIntegrityViolationException ex) {
            return persistenceService.findExistingInNewTransaction(kakaoUser.providerUserId())
                    .orElseThrow(() -> new ConflictException(PROVIDER_OWNER_CONFLICT_MESSAGE));
        }
    }

    public record KakaoAccount(Long userId, String nickname) {
    }
}
