package com.fishnote.source;

import com.fishnote.common.NotFoundException;
import com.fishnote.source.dto.FishClaimSourcesResponse;
import com.fishnote.source.dto.FishSourceItemResponse;
import com.fishnote.source.dto.FishSourceSummaryResponse;
import com.fishnote.source.dto.FishSourcesResponse;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class FishSourceService {

    private static final Comparator<FishSource> SOURCE_ORDER = Comparator
            .comparing(
                    FishSource::getVerifiedAt,
                    Comparator.nullsLast(Comparator.reverseOrder()))
            .thenComparing(
                    FishSource::getPublishedAt,
                    Comparator.nullsLast(Comparator.reverseOrder()))
            .thenComparing(FishSource::getId, Comparator.nullsLast(Comparator.naturalOrder()));

    private final FishSourceRepository fishSourceRepository;

    public FishSourceService(FishSourceRepository fishSourceRepository) {
        this.fishSourceRepository = fishSourceRepository;
    }

    public FishSourcesResponse getSources(String identifier) {
        FishSourceTarget target = findTarget(identifier)
                .orElseThrow(() -> new NotFoundException("횟감을 찾을 수 없습니다."));
        List<FishSource> allSources = fishSourceRepository.findAllByFishId(target.getFishId()).stream()
                .sorted(SOURCE_ORDER)
                .toList();

        Map<FishClaimType, List<FishSource>> sourcesByClaim = new EnumMap<>(FishClaimType.class);
        for (FishClaimType claimType : FishClaimType.values()) {
            sourcesByClaim.put(claimType, new ArrayList<>());
        }
        allSources.forEach(source -> sourcesByClaim.get(source.getClaimType()).add(source));

        List<FishClaimSourcesResponse> claims = new ArrayList<>();
        for (FishClaimType claimType : FishClaimType.values()) {
            List<FishSource> claimSources = List.copyOf(sourcesByClaim.get(claimType));
            claims.add(new FishClaimSourcesResponse(
                    claimType,
                    verificationStatus(claimSources),
                    lastVerifiedAt(claimSources),
                    claimSources.size(),
                    claimSources.stream().map(this::toResponse).toList()));
        }
        int verifiedClaimCount = (int) claims.stream()
                .filter(claim -> claim.verificationStatus() == VerificationStatus.VERIFIED)
                .count();

        return new FishSourcesResponse(
                target.getFishId(),
                target.getFishName(),
                new FishSourceSummaryResponse(
                        summaryVerificationStatus(allSources, verifiedClaimCount),
                        lastVerifiedAt(allSources),
                        allSources.size(),
                        verifiedClaimCount,
                        FishClaimType.values().length),
                List.copyOf(claims));
    }

    private VerificationStatus summaryVerificationStatus(
            List<FishSource> allSources, int verifiedClaimCount) {
        if (verifiedClaimCount == FishClaimType.values().length) {
            return VerificationStatus.VERIFIED;
        }
        if (!allSources.isEmpty()) {
            return VerificationStatus.PARTIALLY_VERIFIED;
        }
        return VerificationStatus.UNVERIFIED;
    }

    private Optional<FishSourceTarget> findTarget(String identifier) {
        if (identifier != null && identifier.matches("\\d+")) {
            try {
                return fishSourceRepository.findTargetByFishId(Long.parseLong(identifier));
            } catch (NumberFormatException ignored) {
                return Optional.empty();
            }
        }
        return fishSourceRepository.findTargetBySlug(identifier);
    }

    private VerificationStatus verificationStatus(List<FishSource> sources) {
        if (sources.stream().anyMatch(source -> source.getConfidence() == SourceConfidence.HIGH)) {
            return VerificationStatus.VERIFIED;
        }
        if (!sources.isEmpty()) {
            return VerificationStatus.PARTIALLY_VERIFIED;
        }
        return VerificationStatus.UNVERIFIED;
    }

    private OffsetDateTime lastVerifiedAt(List<FishSource> sources) {
        return sources.stream()
                .map(FishSource::getVerifiedAt)
                .filter(value -> value != null)
                .max(Comparator.naturalOrder())
                .orElse(null);
    }

    private FishSourceItemResponse toResponse(FishSource source) {
        return new FishSourceItemResponse(
                source.getId(),
                source.getClaimType(),
                source.getPublisher(),
                source.getTitle(),
                source.getUrl(),
                source.getPublishedAt(),
                source.getVerifiedAt(),
                source.getLicense(),
                source.getConfidence());
    }
}
