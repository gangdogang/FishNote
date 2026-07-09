package com.fishnote.image;

import static org.hamcrest.Matchers.is;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fishnote.image.dto.ImageUploadResponse;
import com.fishnote.security.JwtTokenProvider;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(ImageController.class)
@AutoConfigureMockMvc(addFilters = false)
class ImageControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private ImageService imageService;

    @MockBean
    private JwtTokenProvider jwtTokenProvider;

    @Test
    void uploadReturnsCreatedWithCloudinaryUrl() throws Exception {
        MockMultipartFile file = new MockMultipartFile(
                "file",
                "review.jpg",
                MediaType.IMAGE_JPEG_VALUE,
                "image".getBytes());
        when(imageService.upload(any())).thenReturn(new ImageUploadResponse(
                "https://res.cloudinary.com/demo/image/upload/fishnote/reviews/review.jpg"));

        mockMvc.perform(multipart("/api/v1/images").file(file))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.url", is("https://res.cloudinary.com/demo/image/upload/fishnote/reviews/review.jpg")));
    }

    @Test
    void missingFileReturnsStandardBadRequestError() throws Exception {
        when(imageService.upload(isNull())).thenThrow(new IllegalArgumentException("파일은 필수입니다."));

        mockMvc.perform(multipart("/api/v1/images"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status", is(400)))
                .andExpect(jsonPath("$.error", is("Bad Request")))
                .andExpect(jsonPath("$.message", is("파일은 필수입니다.")))
                .andExpect(jsonPath("$.path", is("/api/v1/images")));
    }

    @Test
    void imageUploadFailureReturnsStandardServerError() throws Exception {
        MockMultipartFile file = new MockMultipartFile(
                "file",
                "review.jpg",
                MediaType.IMAGE_JPEG_VALUE,
                "image".getBytes());
        when(imageService.upload(any())).thenThrow(new ImageUploadException("이미지 업로드에 실패했습니다."));

        mockMvc.perform(multipart("/api/v1/images").file(file))
                .andExpect(status().isInternalServerError())
                .andExpect(jsonPath("$.status", is(500)))
                .andExpect(jsonPath("$.error", is("Internal Server Error")))
                .andExpect(jsonPath("$.message", is("이미지 업로드에 실패했습니다.")))
                .andExpect(jsonPath("$.path", is("/api/v1/images")));
    }
}
