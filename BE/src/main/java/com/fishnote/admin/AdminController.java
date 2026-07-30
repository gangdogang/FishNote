package com.fishnote.admin;

import com.fishnote.admin.dto.AdminCorrectionResponse;
import com.fishnote.admin.dto.AdminCorrectionUpdateRequest;
import com.fishnote.admin.dto.AdminFishResponse;
import com.fishnote.admin.dto.AdminFishUpsertRequest;
import com.fishnote.admin.dto.AdminOverviewResponse;
import com.fishnote.admin.dto.AdminReviewResponse;
import com.fishnote.correction.CorrectionRequestStatus;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/admin")
public class AdminController {

    private final AdminService adminService;

    public AdminController(AdminService adminService) {
        this.adminService = adminService;
    }

    @GetMapping("/overview")
    public AdminOverviewResponse overview() {
        return adminService.overview();
    }

    @GetMapping("/fishes")
    public List<AdminFishResponse> fishes() {
        return adminService.listFishes();
    }

    @PostMapping("/fishes")
    @ResponseStatus(HttpStatus.CREATED)
    public AdminFishResponse createFish(
            @AuthenticationPrincipal Long actorUserId,
            @Valid @RequestBody AdminFishUpsertRequest request) {
        return adminService.createFish(actorUserId, request);
    }

    @PutMapping("/fishes/{fishId}")
    public AdminFishResponse updateFish(
            @AuthenticationPrincipal Long actorUserId,
            @PathVariable Long fishId,
            @Valid @RequestBody AdminFishUpsertRequest request) {
        return adminService.updateFish(actorUserId, fishId, request);
    }

    @GetMapping("/corrections")
    public List<AdminCorrectionResponse> corrections(
            @RequestParam(required = false) CorrectionRequestStatus status,
            @RequestParam(defaultValue = "50") int limit) {
        return adminService.listCorrections(status, limit);
    }

    @PatchMapping("/corrections/{correctionId}")
    public AdminCorrectionResponse updateCorrection(
            @AuthenticationPrincipal Long actorUserId,
            @PathVariable Long correctionId,
            @Valid @RequestBody AdminCorrectionUpdateRequest request) {
        return adminService.updateCorrection(actorUserId, correctionId, request.status());
    }

    @GetMapping("/reviews")
    public List<AdminReviewResponse> reviews(
            @RequestParam(defaultValue = "50") int limit) {
        return adminService.listReviews(limit);
    }

    @DeleteMapping("/reviews/{reviewId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteReview(
            @AuthenticationPrincipal Long actorUserId,
            @PathVariable Long reviewId) {
        adminService.deleteReview(actorUserId, reviewId);
    }
}
