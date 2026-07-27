package com.fishnote.image;

import static org.hamcrest.Matchers.is;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fishnote.common.RateLimitFilter;
import com.fishnote.common.ClientIpResolver;
import com.fishnote.image.dto.ImageUploadResponse;
import com.fishnote.security.JwtTokenProvider;
import java.time.OffsetDateTime;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(ImageController.class)
@AutoConfigureMockMvc(addFilters = false)
class ImageControllerTest {

    private static final UUID ASSET_ID =
            UUID.fromString("ab4fd622-a3b6-45cc-bf73-b1f2ff45b76d");
    private static final OffsetDateTime EXPIRES_AT =
            OffsetDateTime.parse("2026-07-22T13:00:00Z");
    private static final String UPLOADER_KEY =
            "v1:7c9e76c7fe3a8c9d7c9e76c7fe3a8c9d7c9e76c7fe3a8c9d7c9e76c7fe3a8c9d";

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private ImageService imageService;

    @MockitoBean
    private JwtTokenProvider jwtTokenProvider;

    @MockitoBean
    private RateLimitFilter rateLimitFilter;

    @MockitoBean
    private ClientIpResolver clientIpResolver;

    @MockitoBean
    private ImageUploaderKeyFactory uploaderKeyFactory;

    @Test
    void uploadReturnsCreatedWithCloudinaryUrl() throws Exception {
        stubAnonymousUploader();
        MockMultipartFile file = new MockMultipartFile(
                "file",
                "review.jpg",
                MediaType.IMAGE_JPEG_VALUE,
                "image".getBytes());
        when(imageService.upload(any(), eq(UPLOADER_KEY))).thenReturn(new ImageUploadResponse(
                "https://res.cloudinary.com/demo/image/upload/fishnote/reviews/review.jpg",
                ASSET_ID,
                EXPIRES_AT));

        mockMvc.perform(multipart("/api/v1/images").file(file))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.url", is("https://res.cloudinary.com/demo/image/upload/fishnote/reviews/review.jpg")))
                .andExpect(jsonPath("$.assetId", is(ASSET_ID.toString())))
                .andExpect(jsonPath("$.expiresAt", is("2026-07-22T13:00:00Z")))
                .andExpect(jsonPath("$.uploaderKey").doesNotExist())
                .andExpect(jsonPath("$.publicId").doesNotExist());
    }

    @Test
    void missingFileReturnsStandardBadRequestError() throws Exception {
        stubAnonymousUploader();
        when(imageService.upload(isNull(), eq(UPLOADER_KEY)))
                .thenThrow(new IllegalArgumentException("파일은 필수입니다."));

        mockMvc.perform(multipart("/api/v1/images"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status", is(400)))
                .andExpect(jsonPath("$.error", is("Bad Request")))
                .andExpect(jsonPath("$.message", is("파일은 필수입니다.")))
                .andExpect(jsonPath("$.path", is("/api/v1/images")));
    }

    @Test
    void imageUploadFailureReturnsStandardServerError() throws Exception {
        stubAnonymousUploader();
        MockMultipartFile file = new MockMultipartFile(
                "file",
                "review.jpg",
                MediaType.IMAGE_JPEG_VALUE,
                "image".getBytes());
        when(imageService.upload(any(), eq(UPLOADER_KEY)))
                .thenThrow(new ImageUploadException("이미지 업로드에 실패했습니다."));

        mockMvc.perform(multipart("/api/v1/images").file(file))
                .andExpect(status().isInternalServerError())
                .andExpect(jsonPath("$.status", is(500)))
                .andExpect(jsonPath("$.error", is("Internal Server Error")))
                .andExpect(jsonPath("$.message", is("이미지 업로드에 실패했습니다.")))
                .andExpect(jsonPath("$.path", is("/api/v1/images")));
    }

    @Test
    void authenticatedUploaderUsesUserIdentityWithoutResolvingIp() {
        MockMultipartFile file = new MockMultipartFile(
                "file",
                "review.jpg",
                MediaType.IMAGE_JPEG_VALUE,
                "image".getBytes());
        MockHttpServletRequest request = new MockHttpServletRequest();
        when(uploaderKeyFactory.forUser(42L)).thenReturn(UPLOADER_KEY);
        ImageUploadResponse expected = new ImageUploadResponse(
                "https://res.cloudinary.com/demo/image/upload/fishnote/reviews/review.jpg",
                ASSET_ID,
                EXPIRES_AT);
        when(imageService.upload(file, UPLOADER_KEY)).thenReturn(expected);

        ImageController controller =
                new ImageController(imageService, clientIpResolver, uploaderKeyFactory);

        org.assertj.core.api.Assertions.assertThat(controller.upload(file, 42L, request))
                .isSameAs(expected);
        verify(uploaderKeyFactory).forUser(42L);
        verify(uploaderKeyFactory, never()).forAnonymous(any());
        verifyNoInteractions(clientIpResolver);
    }

    private void stubAnonymousUploader() {
        when(clientIpResolver.resolve(any())).thenReturn("203.0.113.42");
        when(uploaderKeyFactory.forAnonymous("203.0.113.42")).thenReturn(UPLOADER_KEY);
    }
}
