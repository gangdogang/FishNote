package com.fishnote.user;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.fishnote.common.ConflictException;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.DataIntegrityViolationException;

@ExtendWith(MockitoExtension.class)
class KakaoAccountServiceTest {

    @Mock
    private KakaoAccountPersistenceService persistenceService;

    @InjectMocks
    private KakaoAccountService service;

    @Test
    void reloadsWinningProviderAccountAfterUniqueRaceRollsBack() {
        KakaoOAuthClient.KakaoUser kakaoUser = kakaoUser("provider-123");
        KakaoAccountService.KakaoAccount winner =
                new KakaoAccountService.KakaoAccount(17L, "승리자");
        when(persistenceService.loginInNewTransaction(kakaoUser))
                .thenThrow(new DataIntegrityViolationException("unique race"));
        when(persistenceService.findExistingInNewTransaction("provider-123"))
                .thenReturn(Optional.of(winner));

        assertThat(service.login(kakaoUser)).isEqualTo(winner);
        verify(persistenceService).findExistingInNewTransaction("provider-123");
    }

    @Test
    void mapsUnresolvedOwnerConflictInsteadOfLeakingGenericIntegrityFailure() {
        KakaoOAuthClient.KakaoUser kakaoUser = kakaoUser("provider-456");
        when(persistenceService.loginInNewTransaction(kakaoUser))
                .thenThrow(new DataIntegrityViolationException("provider owner conflict"));
        when(persistenceService.findExistingInNewTransaction("provider-456"))
                .thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.login(kakaoUser))
                .isInstanceOf(ConflictException.class)
                .hasMessage("이 이메일 계정에는 다른 카카오 계정이 연결되어 있습니다.");
    }

    private KakaoOAuthClient.KakaoUser kakaoUser(String providerUserId) {
        return new KakaoOAuthClient.KakaoUser(
                providerUserId,
                "oauth@example.com",
                "카카오 테스터",
                true);
    }
}
