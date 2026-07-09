package com.fishnote.bookmark;

import com.fishnote.bookmark.dto.BookmarkMergeRequest;
import com.fishnote.fish.dto.FishSummaryResponse;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/me/bookmarks")
public class BookmarkController {

    private final BookmarkService bookmarkService;

    public BookmarkController(BookmarkService bookmarkService) {
        this.bookmarkService = bookmarkService;
    }

    @GetMapping
    public List<FishSummaryResponse> list(@AuthenticationPrincipal Long userId) {
        return bookmarkService.findBookmarks(userId);
    }

    @PutMapping("/{fishId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void add(@AuthenticationPrincipal Long userId, @PathVariable Long fishId) {
        bookmarkService.addBookmark(userId, fishId);
    }

    @DeleteMapping("/{fishId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@AuthenticationPrincipal Long userId, @PathVariable Long fishId) {
        bookmarkService.deleteBookmark(userId, fishId);
    }

    @PostMapping("/merge")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void merge(@AuthenticationPrincipal Long userId, @Valid @RequestBody BookmarkMergeRequest request) {
        bookmarkService.mergeBookmarks(userId, request.fishIds());
    }
}
