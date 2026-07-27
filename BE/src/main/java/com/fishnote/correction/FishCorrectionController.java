package com.fishnote.correction;

import com.fishnote.correction.dto.CreateFishCorrectionRequest;
import com.fishnote.correction.dto.CreateFishCorrectionResponse;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Positive;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/fish/{fishId}/corrections")
@Validated
public class FishCorrectionController {

    private final FishCorrectionService correctionService;

    public FishCorrectionController(FishCorrectionService correctionService) {
        this.correctionService = correctionService;
    }

    @PostMapping(
            consumes = MediaType.APPLICATION_JSON_VALUE,
            produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<CreateFishCorrectionResponse> create(
            @PathVariable @Positive(message = "생선 ID는 양수여야 합니다.") Long fishId,
            @Valid @RequestBody CreateFishCorrectionRequest request) {
        return ResponseEntity.accepted().body(correctionService.create(fishId, request));
    }
}
