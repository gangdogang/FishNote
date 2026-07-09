package com.fishnote.bookmark;

import com.fishnote.common.NotFoundException;
import com.fishnote.common.UnauthorizedException;
import com.fishnote.fish.Fish;
import com.fishnote.fish.FishRepository;
import com.fishnote.fish.FishService;
import com.fishnote.fish.dto.FishSummaryResponse;
import com.fishnote.user.User;
import com.fishnote.user.UserRepository;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class BookmarkService {

    private final UserBookmarkRepository bookmarkRepository;
    private final UserRepository userRepository;
    private final FishRepository fishRepository;
    private final FishService fishService;

    public BookmarkService(
            UserBookmarkRepository bookmarkRepository,
            UserRepository userRepository,
            FishRepository fishRepository,
            FishService fishService) {
        this.bookmarkRepository = bookmarkRepository;
        this.userRepository = userRepository;
        this.fishRepository = fishRepository;
        this.fishService = fishService;
    }

    @Transactional(readOnly = true)
    public List<FishSummaryResponse> findBookmarks(Long userId) {
        ensureUserExists(userId);
        List<Long> fishIds = bookmarkRepository.findFishIdsByUserIdOrderByCreatedAt(userId);
        if (fishIds.isEmpty()) {
            return List.of();
        }

        Map<Long, Fish> fishesById = fishRepository.findSummariesByIds(fishIds).stream()
                .collect(Collectors.toMap(Fish::getId, Function.identity(), (first, ignored) -> first));
        List<Fish> orderedFishes = fishIds.stream()
                .map(fishesById::get)
                .filter(Objects::nonNull)
                .toList();
        return fishService.summarizeFishes(orderedFishes);
    }

    @Transactional
    public void addBookmark(Long userId, Long fishId) {
        UserBookmarkId id = new UserBookmarkId(userId, fishId);
        if (bookmarkRepository.existsById(id)) {
            return;
        }

        User user = findUser(userId);
        Fish fish = fishRepository.findById(fishId)
                .orElseThrow(() -> new NotFoundException("생선을 찾을 수 없습니다."));
        bookmarkRepository.save(new UserBookmark(user, fish));
    }

    @Transactional
    public void deleteBookmark(Long userId, Long fishId) {
        ensureUserExists(userId);
        bookmarkRepository.deleteByUserIdAndFishId(userId, fishId);
    }

    @Transactional
    public void mergeBookmarks(Long userId, List<Long> fishIds) {
        User user = findUser(userId);
        List<Long> requestedIds = new LinkedHashSet<>(fishIds).stream().toList();
        if (requestedIds.isEmpty()) {
            return;
        }

        Set<Long> existingFishIds = Set.copyOf(fishRepository.findExistingIds(requestedIds));
        if (existingFishIds.isEmpty()) {
            return;
        }
        Set<Long> alreadyBookmarkedIds = bookmarkRepository.findBookmarkedFishIds(userId, existingFishIds);
        OffsetDateTime baseCreatedAt = OffsetDateTime.now();

        List<UserBookmark> bookmarks = new ArrayList<>();
        for (Long fishId : requestedIds) {
            if (!existingFishIds.contains(fishId) || alreadyBookmarkedIds.contains(fishId)) {
                continue;
            }
            UserBookmark bookmark = new UserBookmark(user, fishRepository.getReferenceById(fishId));
            bookmark.setCreatedAt(baseCreatedAt.plusNanos(1_000_000L * bookmarks.size()));
            bookmarks.add(bookmark);
        }
        bookmarkRepository.saveAll(bookmarks);
    }

    private User findUser(Long userId) {
        return userRepository.findById(userId)
                .orElseThrow(() -> new UnauthorizedException("인증이 필요합니다."));
    }

    private void ensureUserExists(Long userId) {
        if (!userRepository.existsById(userId)) {
            throw new UnauthorizedException("인증이 필요합니다.");
        }
    }
}
