package com.fishnote.tasting;

import com.fishnote.image.ImageUploaderKeyFactory;
import com.fishnote.tasting.dto.TastingEntryPageResponse;
import com.fishnote.tasting.dto.TastingEntryRequest;
import com.fishnote.tasting.dto.TastingEntryResponse;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/me/tastings")
public class TastingEntryController {

    private final TastingEntryService service;
    private final ImageUploaderKeyFactory imageUploaderKeyFactory;

    public TastingEntryController(
            TastingEntryService service,
            ImageUploaderKeyFactory imageUploaderKeyFactory) {
        this.service = service;
        this.imageUploaderKeyFactory = imageUploaderKeyFactory;
    }

    @GetMapping
    public TastingEntryPageResponse list(
            @AuthenticationPrincipal Long userId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "24") int size) {
        return service.findEntries(userId, page, size);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public TastingEntryResponse create(
            @AuthenticationPrincipal Long userId,
            @Valid @RequestBody TastingEntryRequest request) {
        return service.create(userId, request, imageUploaderKeyFactory.forUser(userId));
    }

    @PutMapping("/{entryId}")
    public TastingEntryResponse update(
            @AuthenticationPrincipal Long userId,
            @PathVariable Long entryId,
            @Valid @RequestBody TastingEntryRequest request) {
        return service.update(userId, entryId, request, imageUploaderKeyFactory.forUser(userId));
    }

    @DeleteMapping("/{entryId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(
            @AuthenticationPrincipal Long userId,
            @PathVariable Long entryId) {
        service.delete(userId, entryId);
    }
}
