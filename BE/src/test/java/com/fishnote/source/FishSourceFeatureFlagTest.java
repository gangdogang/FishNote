package com.fishnote.source;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.verifyNoInteractions;

import com.fishnote.common.FeatureDisabledException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class FishSourceFeatureFlagTest {

    @Mock
    private FishSourceService fishSourceService;

    @Test
    void disabledSourcesFlagFailsBeforeQuerying() {
        FishSourceController controller = new FishSourceController(fishSourceService, false);

        assertThatThrownBy(() -> controller.sources("gwangeo"))
                .isInstanceOf(FeatureDisabledException.class);

        verifyNoInteractions(fishSourceService);
    }
}
