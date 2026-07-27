package com.fishnote.image;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;

class ImageUploaderKeyFactoryTest {

    private static final String SECRET =
            "test-image-uploader-key-secret-with-at-least-32-bytes";

    private final ImageUploaderKeyFactory factory = new ImageUploaderKeyFactory(SECRET);

    @Test
    void createsStableVersionedOpaqueKeysPerIdentityDomain() {
        String userKey = factory.forUser(42L);
        String sameUserKey = factory.forUser(42L);
        String otherUserKey = factory.forUser(43L);
        String anonymousKey = factory.forAnonymous("203.0.113.42");

        assertThat(userKey)
                .isEqualTo(sameUserKey)
                .matches("v1:[0-9a-f]{64}")
                .isNotEqualTo("v1:42")
                .doesNotContain(SECRET);
        assertThat(otherUserKey).isNotEqualTo(userKey);
        assertThat(anonymousKey)
                .matches("v1:[0-9a-f]{64}")
                .doesNotContain("203.0.113.42")
                .isNotEqualTo(userKey);
    }

    @Test
    void userKeyDoesNotDependOnNetworkAddressAndAnonymousAddressesRemainSeparated() {
        assertThat(factory.forUser(7L)).isEqualTo(factory.forUser(7L));
        assertThat(factory.forAnonymous("2001:db8::1"))
                .isEqualTo(factory.forAnonymous("2001:db8::1"))
                .isNotEqualTo(factory.forAnonymous("2001:db8::2"));
    }

    @Test
    void invalidIdentityAndShortSecretFailClosed() {
        assertThatThrownBy(() -> new ImageUploaderKeyFactory("too-short"))
                .isInstanceOf(IllegalStateException.class)
                .hasMessage("IMAGE_UPLOADER_KEY_SECRET은 32바이트 이상이어야 합니다.");
        assertThatThrownBy(() -> new ImageUploaderKeyFactory(null))
                .isInstanceOf(IllegalStateException.class);
        assertThatThrownBy(() -> factory.forUser(null))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> factory.forUser(0L))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> factory.forAnonymous("unknown"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("클라이언트 주소를 확인할 수 없습니다.");
        assertThatThrownBy(() -> factory.forAnonymous("  "))
                .isInstanceOf(IllegalArgumentException.class);
    }
}
