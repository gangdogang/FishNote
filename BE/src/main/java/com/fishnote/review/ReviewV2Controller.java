package com.fishnote.review;

import com.fishnote.review.dto.ReviewCursorListResponse;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v2/fish/{fishId}/reviews")
public class ReviewV2Controller {

    private final ReviewV2Service reviewService;

    public ReviewV2Controller(ReviewV2Service reviewService) {
        this.reviewService = reviewService;
    }

    @GetMapping
    public ReviewCursorListResponse list(
            @PathVariable Long fishId,
            @RequestParam(defaultValue = "latest") String sort,
            @RequestParam(defaultValue = "20") int limit,
            @RequestParam(required = false) String cursor,
            @RequestParam(defaultValue = "true") boolean includeSummary,
            @AuthenticationPrincipal Long userId) {
        return reviewService.findReviews(fishId, sort, limit, cursor, includeSummary, userId);
    }
}
