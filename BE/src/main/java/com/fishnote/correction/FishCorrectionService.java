package com.fishnote.correction;

import com.fishnote.common.NotFoundException;
import com.fishnote.correction.dto.CreateFishCorrectionRequest;
import com.fishnote.correction.dto.CreateFishCorrectionResponse;
import com.fishnote.fish.Fish;
import com.fishnote.fish.FishRepository;
import java.net.URI;
import java.net.URISyntaxException;
import java.util.Locale;
import java.util.regex.Pattern;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class FishCorrectionService {

    private static final int MAX_MESSAGE_LENGTH = 1000;
    private static final int MAX_SOURCE_URL_LENGTH = 2048;
    private static final Pattern ENCODED_CONTROL_CHARACTER = Pattern.compile(
            "%(?:0[0-9a-f]|1[0-9a-f]|7f|8[0-9a-f]|9[0-9a-f])",
            Pattern.CASE_INSENSITIVE);

    private final FishRepository fishRepository;
    private final FishCorrectionRequestRepository correctionRepository;

    public FishCorrectionService(
            FishRepository fishRepository,
            FishCorrectionRequestRepository correctionRepository) {
        this.fishRepository = fishRepository;
        this.correctionRepository = correctionRepository;
    }

    @Transactional
    public CreateFishCorrectionResponse create(long fishId, CreateFishCorrectionRequest request) {
        if (fishId <= 0) {
            throw new IllegalArgumentException("생선 ID는 양수여야 합니다.");
        }
        if (request == null || request.claimType() == null) {
            throw new IllegalArgumentException("주장 유형은 필수입니다.");
        }

        String message = normalizeMessage(request.message());
        String sourceUrl = normalizeSourceUrl(request.sourceUrl());
        Fish fish = fishRepository.findById(fishId)
                .orElseThrow(() -> new NotFoundException("생선을 찾을 수 없습니다."));
        FishCorrectionRequest saved = correctionRepository.save(
                new FishCorrectionRequest(fish, request.claimType(), message, sourceUrl));
        return new CreateFishCorrectionResponse(saved.getId(), saved.getStatus());
    }

    private String normalizeMessage(String rawMessage) {
        if (rawMessage == null) {
            throw new IllegalArgumentException("제보 내용은 필수입니다.");
        }
        String message = rawMessage.strip();
        if (message.isBlank()) {
            throw new IllegalArgumentException("제보 내용은 비어 있을 수 없습니다.");
        }
        if (message.codePointCount(0, message.length()) > MAX_MESSAGE_LENGTH) {
            throw new IllegalArgumentException("제보 내용은 1000자 이하여야 합니다.");
        }
        return message;
    }

    private String normalizeSourceUrl(String rawSourceUrl) {
        if (rawSourceUrl == null) {
            return null;
        }
        if (rawSourceUrl.codePoints().anyMatch(Character::isISOControl)
                || ENCODED_CONTROL_CHARACTER.matcher(rawSourceUrl).find()) {
            throw new IllegalArgumentException("출처 URL에 제어 문자를 포함할 수 없습니다.");
        }

        String sourceUrl = rawSourceUrl.strip();
        if (sourceUrl.isBlank()) {
            return null;
        }
        if (sourceUrl.codePointCount(0, sourceUrl.length()) > MAX_SOURCE_URL_LENGTH) {
            throw new IllegalArgumentException("출처 URL은 2048자 이하여야 합니다.");
        }

        final URI uri;
        try {
            uri = new URI(sourceUrl);
        } catch (URISyntaxException exception) {
            throw new IllegalArgumentException("출처 URL 형식이 올바르지 않습니다.");
        }
        String scheme = uri.getScheme();
        if (!uri.isAbsolute()
                || uri.isOpaque()
                || scheme == null
                || !(scheme.equalsIgnoreCase("http") || scheme.equalsIgnoreCase("https"))
                || uri.getHost() == null
                || uri.getHost().isBlank()
                || uri.getRawUserInfo() != null) {
            throw new IllegalArgumentException("출처 URL은 사용자 정보 없는 절대 http/https URL이어야 합니다.");
        }
        String normalizedScheme = scheme.toLowerCase(Locale.ROOT);
        return normalizedScheme + sourceUrl.substring(scheme.length());
    }
}
