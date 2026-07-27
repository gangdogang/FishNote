package com.fishnote.user;

import com.fishnote.common.ConflictException;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.Locale;
import java.util.Optional;
import org.springframework.jdbc.core.ConnectionCallback;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

@Service
public class KakaoAccountPersistenceService {

    private static final String PROVIDER_OWNER_CONFLICT_MESSAGE =
            "이 이메일 계정에는 다른 카카오 계정이 연결되어 있습니다.";
    private static final String UPSERT_USER_SQL = """
            INSERT INTO users(email, password_hash, nickname, created_at)
            VALUES (?, NULL, ?, CURRENT_TIMESTAMP)
            ON CONFLICT (email) DO UPDATE SET email = EXCLUDED.email
            RETURNING id, nickname
            """;

    private final UserRepository userRepository;
    private final UserOAuthAccountRepository oauthAccountRepository;
    private final JdbcTemplate jdbcTemplate;

    public KakaoAccountPersistenceService(
            UserRepository userRepository,
            UserOAuthAccountRepository oauthAccountRepository,
            JdbcTemplate jdbcTemplate) {
        this.userRepository = userRepository;
        this.oauthAccountRepository = oauthAccountRepository;
        this.jdbcTemplate = jdbcTemplate;
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public KakaoAccountService.KakaoAccount loginInNewTransaction(
            KakaoOAuthClient.KakaoUser kakaoUser) {
        return jdbcTemplate.execute((ConnectionCallback<KakaoAccountService.KakaoAccount>) connection -> {
            if (isPostgreSql(connection)) {
                return loginPostgreSql(connection, kakaoUser);
            }
            return loginPortable(kakaoUser);
        });
    }

    @Transactional(readOnly = true, propagation = Propagation.REQUIRES_NEW)
    public Optional<KakaoAccountService.KakaoAccount> findExistingInNewTransaction(
            String providerUserId) {
        return findExisting(providerUserId);
    }

    private KakaoAccountService.KakaoAccount loginPostgreSql(
            Connection connection,
            KakaoOAuthClient.KakaoUser kakaoUser) throws SQLException {
        lockProviderIdentity(connection, kakaoUser.providerUserId());
        Optional<KakaoAccountService.KakaoAccount> existing = findExisting(kakaoUser.providerUserId());
        if (existing.isPresent()) {
            return existing.get();
        }

        ResolvedUser user = resolvePostgreSqlUser(connection, kakaoUser);
        oauthAccountRepository.insertProviderAccountIfAbsent(
                OAuthProvider.KAKAO.name(),
                kakaoUser.providerUserId(),
                user.id());

        return findExisting(kakaoUser.providerUserId())
                .orElseThrow(() -> new ConflictException(PROVIDER_OWNER_CONFLICT_MESSAGE));
    }

    private KakaoAccountService.KakaoAccount loginPortable(KakaoOAuthClient.KakaoUser kakaoUser) {
        Optional<KakaoAccountService.KakaoAccount> existing = findExisting(kakaoUser.providerUserId());
        if (existing.isPresent()) {
            return existing.get();
        }

        String verifiedEmail = verifiedEmail(kakaoUser);
        User user = verifiedEmail == null
                ? createKakaoUser(null, kakaoUser.nickname())
                : userRepository.findByEmail(verifiedEmail)
                        .orElseGet(() -> createKakaoUser(verifiedEmail, kakaoUser.nickname()));

        if (oauthAccountRepository.existsByProviderAndUserId(OAuthProvider.KAKAO, user.getId())) {
            throw new ConflictException(PROVIDER_OWNER_CONFLICT_MESSAGE);
        }
        oauthAccountRepository.saveAndFlush(
                new UserOAuthAccount(OAuthProvider.KAKAO, kakaoUser.providerUserId(), user));
        return new KakaoAccountService.KakaoAccount(user.getId(), user.getNickname());
    }

    private ResolvedUser resolvePostgreSqlUser(
            Connection connection,
            KakaoOAuthClient.KakaoUser kakaoUser) throws SQLException {
        String email = verifiedEmail(kakaoUser);
        if (email == null) {
            User user = createKakaoUser(null, kakaoUser.nickname());
            return new ResolvedUser(user.getId(), user.getNickname());
        }

        try (PreparedStatement statement = connection.prepareStatement(UPSERT_USER_SQL)) {
            statement.setString(1, email);
            statement.setString(2, normalizeNickname(kakaoUser.nickname()));
            try (ResultSet result = statement.executeQuery()) {
                if (!result.next()) {
                    throw new IllegalStateException("카카오 사용자 upsert가 결과를 반환하지 않았습니다.");
                }
                return new ResolvedUser(result.getLong("id"), result.getString("nickname"));
            }
        }
    }

    private void lockProviderIdentity(Connection connection, String providerUserId) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(
                "SELECT pg_advisory_xact_lock(hashtextextended(?, 0))")) {
            statement.setString(1, OAuthProvider.KAKAO.name() + ':' + providerUserId);
            try (ResultSet ignored = statement.executeQuery()) {
                if (!ignored.next()) {
                    throw new IllegalStateException("카카오 provider 잠금을 획득하지 못했습니다.");
                }
            }
        }
    }

    private Optional<KakaoAccountService.KakaoAccount> findExisting(String providerUserId) {
        return oauthAccountRepository
                .findByProviderAndProviderUserId(OAuthProvider.KAKAO, providerUserId)
                .map(UserOAuthAccount::getUser)
                .map(user -> new KakaoAccountService.KakaoAccount(user.getId(), user.getNickname()));
    }

    private User createKakaoUser(String email, String nickname) {
        User created = new User();
        created.setEmail(email);
        created.setPasswordHash(null);
        created.setNickname(normalizeNickname(nickname));
        return userRepository.saveAndFlush(created);
    }

    private String verifiedEmail(KakaoOAuthClient.KakaoUser kakaoUser) {
        return kakaoUser.verifiedEmail()
                && kakaoUser.email() != null
                && !kakaoUser.email().isBlank()
                ? normalizeEmail(kakaoUser.email())
                : null;
    }

    private String normalizeNickname(String nickname) {
        String normalized = nickname == null ? "" : nickname.trim();
        if (normalized.isEmpty()) {
            return "FishNote 사용자";
        }
        return normalized.length() <= 30 ? normalized : normalized.substring(0, 30);
    }

    private String normalizeEmail(String email) {
        return email.trim().toLowerCase(Locale.ROOT);
    }

    private boolean isPostgreSql(Connection connection) throws SQLException {
        return "PostgreSQL".equals(connection.getMetaData().getDatabaseProductName());
    }

    private record ResolvedUser(Long id, String nickname) {
    }
}
