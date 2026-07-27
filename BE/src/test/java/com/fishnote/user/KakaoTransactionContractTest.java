package com.fishnote.user;

import static org.assertj.core.api.Assertions.assertThat;

import com.fishnote.user.dto.KakaoLoginRequest;
import java.lang.reflect.Method;
import org.junit.jupiter.api.Test;
import org.springframework.core.annotation.AnnotationUtils;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

class KakaoTransactionContractTest {

    @Test
    void externalCallAndRetryCoordinatorStayOutsidePersistenceTransactions() throws Exception {
        Method externalCoordinator =
                AuthService.class.getMethod("loginWithKakao", KakaoLoginRequest.class);
        Method retryCoordinator =
                KakaoAccountService.class.getMethod("login", KakaoOAuthClient.KakaoUser.class);
        Method persistence = KakaoAccountPersistenceService.class.getMethod(
                "loginInNewTransaction", KakaoOAuthClient.KakaoUser.class);
        Method conflictReload = KakaoAccountPersistenceService.class.getMethod(
                "findExistingInNewTransaction", String.class);

        Transactional externalTransaction =
                AnnotationUtils.findAnnotation(externalCoordinator, Transactional.class);
        Transactional retryTransaction =
                AnnotationUtils.findAnnotation(retryCoordinator, Transactional.class);
        Transactional persistenceTransaction =
                AnnotationUtils.findAnnotation(persistence, Transactional.class);
        Transactional reloadTransaction =
                AnnotationUtils.findAnnotation(conflictReload, Transactional.class);
        assertThat(externalTransaction).isNotNull();
        assertThat(externalTransaction.propagation()).isEqualTo(Propagation.NOT_SUPPORTED);
        assertThat(retryTransaction).isNotNull();
        assertThat(retryTransaction.propagation()).isEqualTo(Propagation.NOT_SUPPORTED);
        assertThat(persistenceTransaction).isNotNull();
        assertThat(persistenceTransaction.propagation()).isEqualTo(Propagation.REQUIRES_NEW);
        assertThat(reloadTransaction).isNotNull();
        assertThat(reloadTransaction.propagation()).isEqualTo(Propagation.REQUIRES_NEW);
        assertThat(reloadTransaction.readOnly()).isTrue();
    }
}
