package com.fishnote.config;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;

class CloudinaryConfigTest {

    private final CloudinaryConfig config = new CloudinaryConfig();

    @Test
    void appliesABoundedTimeoutToUploadAndDestroyClients() {
        var cloudinary = config.cloudinary(
                "cloudinary://test-key:test-secret@test-cloud", 10);

        assertThat(cloudinary.config.timeout).isEqualTo(10);
    }

    @Test
    void rejectsMissingCredentialsAndUnboundedTimeouts() {
        assertThatThrownBy(() -> config.cloudinary("", 10))
                .isInstanceOf(IllegalStateException.class);
        assertThatThrownBy(() -> config.cloudinary(
                        "cloudinary://test-key:test-secret@test-cloud", 0))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> config.cloudinary(
                        "cloudinary://test-key:test-secret@test-cloud", 61))
                .isInstanceOf(IllegalArgumentException.class);
    }
}
