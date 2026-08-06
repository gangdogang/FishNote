package com.fishnote.tasting;

import com.fishnote.common.NotFoundException;
import com.fishnote.common.UnauthorizedException;
import com.fishnote.fish.Fish;
import com.fishnote.fish.FishRepository;
import com.fishnote.image.ImageAssetAttachmentService;
import com.fishnote.tasting.dto.TastingEntryPageResponse;
import com.fishnote.tasting.dto.TastingEntryRequest;
import com.fishnote.tasting.dto.TastingEntryResponse;
import com.fishnote.tasting.dto.TastingStatsResponse;
import com.fishnote.user.User;
import com.fishnote.user.UserRepository;
import java.time.Clock;
import java.time.LocalDate;
import java.time.YearMonth;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

@Service
public class TastingEntryService {

    private static final int MAX_PAGE_SIZE = 100;
    private final TastingEntryRepository repository;
    private final UserRepository userRepository;
    private final FishRepository fishRepository;
    private final ImageAssetAttachmentService imageAssetAttachmentService;
    private final Clock clock;

    @Autowired
    public TastingEntryService(
            TastingEntryRepository repository,
            UserRepository userRepository,
            FishRepository fishRepository,
            ImageAssetAttachmentService imageAssetAttachmentService) {
        this(repository, userRepository, fishRepository, imageAssetAttachmentService, Clock.systemDefaultZone());
    }

    TastingEntryService(
            TastingEntryRepository repository,
            UserRepository userRepository,
            FishRepository fishRepository,
            ImageAssetAttachmentService imageAssetAttachmentService,
            Clock clock) {
        this.repository = repository;
        this.userRepository = userRepository;
        this.fishRepository = fishRepository;
        this.imageAssetAttachmentService = imageAssetAttachmentService;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public TastingEntryPageResponse findEntries(Long userId, int page, int size) {
        ensureUserExists(userId);
        int safePage = Math.max(page, 0);
        int safeSize = Math.min(Math.max(size, 1), MAX_PAGE_SIZE);
        Page<TastingEntry> entries = repository.findAllByUserId(
                userId,
                PageRequest.of(safePage, safeSize, Sort.by(
                        Sort.Order.desc("tastedOn"),
                        Sort.Order.desc("id"))));
        LocalDate today = LocalDate.now(clock);
        YearMonth month = YearMonth.from(today);
        return new TastingEntryPageResponse(
                entries.getContent().stream().map(this::toResponse).toList(),
                entries.getNumber(),
                entries.getSize(),
                entries.getTotalElements(),
                entries.hasNext(),
                new TastingStatsResponse(
                        entries.getTotalElements(),
                        repository.countDistinctFishByUserId(userId),
                        repository.countByUserIdAndTastedOnBetween(
                                userId,
                                month.atDay(1),
                                month.atEndOfMonth())));
    }

    @Transactional
    public TastingEntryResponse create(
            Long userId,
            TastingEntryRequest request,
            String imageUploaderKey) {
        User user = findUser(userId);
        Fish fish = findFish(request.fishId());
        TastingEntry entry = new TastingEntry();
        entry.setUser(user);
        entry.setFish(fish);
        apply(entry, request);
        entry.setImageUrl(null);
        TastingEntry saved = repository.saveAndFlush(entry);
        saved.setImageUrl(imageAssetAttachmentService.attachToTasting(
                request.imageAssetId(),
                request.imageUrl(),
                imageUploaderKey,
                saved));
        return toResponse(saved);
    }

    @Transactional
    public TastingEntryResponse update(
            Long userId,
            Long entryId,
            TastingEntryRequest request,
            String imageUploaderKey) {
        TastingEntry entry = findOwnedEntry(userId, entryId);
        entry.setFish(findFish(request.fishId()));
        apply(entry, request);
        TastingEntry saved = repository.saveAndFlush(entry);
        if (request.imageAssetId() != null || StringUtils.hasText(request.imageUrl())) {
            imageAssetAttachmentService.queueTastingImageDeletion(saved.getId());
            saved.setImageUrl(imageAssetAttachmentService.attachToTasting(
                    request.imageAssetId(),
                    request.imageUrl(),
                    imageUploaderKey,
                    saved));
        }
        return toResponse(repository.saveAndFlush(saved));
    }

    @Transactional
    public void delete(Long userId, Long entryId) {
        TastingEntry entry = findOwnedEntry(userId, entryId);
        imageAssetAttachmentService.queueTastingImageDeletion(entry.getId());
        repository.delete(entry);
        repository.flush();
    }

    private void apply(TastingEntry entry, TastingEntryRequest request) {
        entry.setTastedOn(request.tastedOn());
        entry.setRating(request.rating());
        entry.setPreparation(request.preparation());
        entry.setPlaceName(normalizeOptional(request.placeName()));
        entry.setNote(normalizeOptional(request.note()));
    }

    private TastingEntry findOwnedEntry(Long userId, Long entryId) {
        ensureUserExists(userId);
        return repository.findByIdAndUserId(entryId, userId)
                .orElseThrow(() -> new NotFoundException("먹어본 기록을 찾을 수 없습니다."));
    }

    private User findUser(Long userId) {
        if (userId == null) {
            throw new UnauthorizedException("인증이 필요합니다.");
        }
        return userRepository.findById(userId)
                .orElseThrow(() -> new UnauthorizedException("인증이 필요합니다."));
    }

    private void ensureUserExists(Long userId) {
        if (userId == null || !userRepository.existsById(userId)) {
            throw new UnauthorizedException("인증이 필요합니다.");
        }
    }

    private Fish findFish(Long fishId) {
        return fishRepository.findById(fishId)
                .orElseThrow(() -> new NotFoundException("횟감을 찾을 수 없습니다."));
    }

    private String normalizeOptional(String value) {
        return StringUtils.hasText(value) ? value.trim() : null;
    }

    private TastingEntryResponse toResponse(TastingEntry entry) {
        Fish fish = entry.getFish();
        return new TastingEntryResponse(
                entry.getId(),
                fish.getId(),
                fish.getSlug(),
                fish.getName(),
                fish.getImageUrl(),
                entry.getTastedOn(),
                entry.getRating(),
                entry.getPreparation(),
                entry.getPlaceName(),
                entry.getNote(),
                entry.getImageUrl(),
                entry.getCreatedAt(),
                entry.getUpdatedAt());
    }
}
