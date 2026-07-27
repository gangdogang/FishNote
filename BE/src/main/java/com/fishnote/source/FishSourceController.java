package com.fishnote.source;

import com.fishnote.common.FeatureDisabledException;
import com.fishnote.source.dto.FishSourcesResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class FishSourceController {

    private final FishSourceService fishSourceService;
    private final boolean enabled;

    public FishSourceController(
            FishSourceService fishSourceService,
            @Value("${app.sources.enabled:true}") boolean enabled) {
        this.fishSourceService = fishSourceService;
        this.enabled = enabled;
    }

    @GetMapping("/api/v1/fish/{identifier}/sources")
    public FishSourcesResponse sources(@PathVariable String identifier) {
        if (!enabled) {
            throw new FeatureDisabledException("출처 조회가 일시적으로 비활성화되었습니다.");
        }
        return fishSourceService.getSources(identifier);
    }
}
