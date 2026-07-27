package com.fishnote.fish;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.verifyNoInteractions;

import com.fishnote.cache.PublicHttpCache;
import com.fishnote.cache.PublicReadCacheService;
import com.fishnote.common.FeatureDisabledException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class FishV2FeatureFlagTest {

    @Mock
    private PublicReadCacheService publicReads;

    @Mock
    private PublicHttpCache httpCache;

    @Test
    void disabledCatalogFlagFailsBeforeReadingOrCaching() {
        FishV2Controller controller = new FishV2Controller(publicReads, httpCache, false);

        assertThatThrownBy(() -> controller.list(
                        null, null, null, null, null, null, null, "popular", 24, null))
                .isInstanceOf(FeatureDisabledException.class);

        verifyNoInteractions(publicReads, httpCache);
    }
}
