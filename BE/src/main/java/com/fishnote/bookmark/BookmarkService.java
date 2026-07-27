package com.fishnote.bookmark;

import com.fishnote.common.NotFoundException;
import com.fishnote.common.UnauthorizedException;
import com.fishnote.bookmark.dto.BookmarkMergeResponse;
import com.fishnote.fish.dto.FishSummaryResponse;
import com.fishnote.fish.query.FishCatalogQueryRepository;
import com.fishnote.user.UserRepository;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class BookmarkService {

    private final UserBookmarkRepository bookmarkRepository;
    private final UserRepository userRepository;
    private final FishCatalogQueryRepository catalogQueryRepository;
    private final BookmarkAtomicRepository atomicRepository;

    public BookmarkService(
            UserBookmarkRepository bookmarkRepository,
            UserRepository userRepository,
            FishCatalogQueryRepository catalogQueryRepository,
            BookmarkAtomicRepository atomicRepository) {
        this.bookmarkRepository = bookmarkRepository;
        this.userRepository = userRepository;
        this.catalogQueryRepository = catalogQueryRepository;
        this.atomicRepository = atomicRepository;
    }

    @Transactional(readOnly = true)
    public List<FishSummaryResponse> findBookmarks(Long userId) {
        ensureUserExists(userId);
        return catalogQueryRepository.findBookmarks(userId);
    }

    @Transactional
    public void addBookmark(Long userId, Long fishId) {
        BookmarkAtomicRepository.BookmarkPutResult result = atomicRepository.add(userId, fishId);
        if (!result.userExists()) {
            throw new UnauthorizedException("인증이 필요합니다.");
        }
        if (!result.fishExists()) {
            throw new NotFoundException("횟감을 찾을 수 없습니다.");
        }
    }

    @Transactional
    public void deleteBookmark(Long userId, Long fishId) {
        ensureUserExists(userId);
        bookmarkRepository.deleteByUserIdAndFishId(userId, fishId);
    }

    @Transactional
    public BookmarkMergeResponse mergeBookmarks(Long userId, List<Long> fishIds) {
        BookmarkAtomicRepository.BookmarkMergeResult result = atomicRepository.merge(userId, fishIds);
        if (!result.userExists()) {
            throw new UnauthorizedException("인증이 필요합니다.");
        }
        return result.response();
    }

    private void ensureUserExists(Long userId) {
        if (!userRepository.existsById(userId)) {
            throw new UnauthorizedException("인증이 필요합니다.");
        }
    }
}
