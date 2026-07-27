package com.fishnote.image;

import com.fishnote.common.ClientIpResolver;
import com.fishnote.image.dto.ImageUploadResponse;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/v1/images")
public class ImageController {

    private final ImageService imageService;
    private final ClientIpResolver clientIpResolver;
    private final ImageUploaderKeyFactory uploaderKeyFactory;

    public ImageController(
            ImageService imageService,
            ClientIpResolver clientIpResolver,
            ImageUploaderKeyFactory uploaderKeyFactory) {
        this.imageService = imageService;
        this.clientIpResolver = clientIpResolver;
        this.uploaderKeyFactory = uploaderKeyFactory;
    }

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @ResponseStatus(HttpStatus.CREATED)
    public ImageUploadResponse upload(
            @RequestPart(name = "file", required = false) MultipartFile file,
            @AuthenticationPrincipal Long userId,
            HttpServletRequest request) {
        String uploaderKey = userId == null
                ? uploaderKeyFactory.forAnonymous(clientIpResolver.resolve(request))
                : uploaderKeyFactory.forUser(userId);
        return imageService.upload(file, uploaderKey);
    }
}
