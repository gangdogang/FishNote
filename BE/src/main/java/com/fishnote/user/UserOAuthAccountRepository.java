package com.fishnote.user;

import java.util.Optional;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface UserOAuthAccountRepository extends JpaRepository<UserOAuthAccount, Long> {

    @EntityGraph(attributePaths = "user")
    Optional<UserOAuthAccount> findByProviderAndProviderUserId(
            OAuthProvider provider,
            String providerUserId);

    boolean existsByProviderAndUserId(OAuthProvider provider, Long userId);

    /** PostgreSQL production path; H2 smoke tests use the JPA fallback. */
    @Modifying(flushAutomatically = true)
    @Query(value = """
            INSERT INTO user_oauth_account(provider, provider_user_id, user_id, created_at)
            VALUES (:provider, :providerUserId, :userId, CURRENT_TIMESTAMP)
            ON CONFLICT DO NOTHING
            """, nativeQuery = true)
    int insertProviderAccountIfAbsent(
            @Param("provider") String provider,
            @Param("providerUserId") String providerUserId,
            @Param("userId") Long userId);

    void deleteAllByUserId(Long userId);
}
