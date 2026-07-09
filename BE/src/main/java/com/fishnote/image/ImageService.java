package com.fishnote.image;

import com.cloudinary.Cloudinary;
import com.fishnote.image.dto.ImageUploadResponse;
import java.io.IOException;
import java.util.Locale;
import java.util.Map;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;

@Service
public class ImageService {

    private static final long MAX_FILE_SIZE_BYTES = 5L * 1024 * 1024;
    private static final String UPLOAD_FOLDER = "fishnote/reviews";
    private static final String UPLOAD_ERROR_MESSAGE = "이미지 업로드에 실패했습니다.";

    private final Cloudinary cloudinary;

    public ImageService(Cloudinary cloudinary) {
        this.cloudinary = cloudinary;
    }

    public ImageUploadResponse upload(MultipartFile file) {
        validate(file);

        try {
            Map<?, ?> uploadResult = cloudinary.uploader().upload(
                    file.getBytes(),
                    Map.of("folder", UPLOAD_FOLDER, "resource_type", "image"));
            String url = uploadUrl(uploadResult);
            return new ImageUploadResponse(url);
        } catch (IOException ex) {
            throw new ImageUploadException(UPLOAD_ERROR_MESSAGE, ex);
        } catch (RuntimeException ex) {
            if (ex instanceof ImageUploadException imageUploadException) {
                throw imageUploadException;
            }
            throw new ImageUploadException(UPLOAD_ERROR_MESSAGE, ex);
        }
    }

    private void validate(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("파일은 필수입니다.");
        }
        if (file.getSize() > MAX_FILE_SIZE_BYTES) {
            throw new IllegalArgumentException("이미지는 5MB 이하만 업로드할 수 있습니다.");
        }

        String contentType = file.getContentType();
        if (!StringUtils.hasText(contentType)
                || !contentType.toLowerCase(Locale.ROOT).startsWith("image/")) {
            throw new IllegalArgumentException("이미지 파일만 업로드할 수 있습니다.");
        }
    }

    private String uploadUrl(Map<?, ?> uploadResult) {
        Object secureUrl = uploadResult.get("secure_url");
        if (secureUrl instanceof String url && StringUtils.hasText(url)) {
            return url;
        }

        throw new ImageUploadException(UPLOAD_ERROR_MESSAGE);
    }
}
