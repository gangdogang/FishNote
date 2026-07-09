package com.fishnote.image;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyMap;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.cloudinary.Cloudinary;
import com.cloudinary.Uploader;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;

@ExtendWith(MockitoExtension.class)
class ImageServiceTest {

    private static final String CLOUDINARY_URL =
            "https://res.cloudinary.com/demo/image/upload/fishnote/reviews/review.jpg";

    @Mock
    private Cloudinary cloudinary;

    @Mock
    private Uploader uploader;

    private ImageService imageService;

    @BeforeEach
    void setUp() {
        imageService = new ImageService(cloudinary);
    }

    @Test
    void uploadReturnsSecureUrlAndUsesReviewFolder() throws Exception {
        MockMultipartFile file = imageFile("review.jpg", "image".getBytes());
        when(cloudinary.uploader()).thenReturn(uploader);
        when(uploader.upload(any(byte[].class), anyMap())).thenReturn(Map.of("secure_url", CLOUDINARY_URL));

        assertThat(imageService.upload(file).url()).isEqualTo(CLOUDINARY_URL);

        @SuppressWarnings("unchecked")
        ArgumentCaptor<Map<String, Object>> optionsCaptor = ArgumentCaptor.forClass(Map.class);
        verify(uploader).upload(any(byte[].class), optionsCaptor.capture());
        assertThat(optionsCaptor.getValue())
                .containsEntry("folder", "fishnote/reviews")
                .containsEntry("resource_type", "image");
    }

    @Test
    void missingFileIsRejected() {
        assertThatThrownBy(() -> imageService.upload(null))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("파일은 필수입니다.");
    }

    @Test
    void emptyFileIsRejected() {
        assertThatThrownBy(() -> imageService.upload(imageFile("empty.jpg", new byte[0])))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("파일은 필수입니다.");
    }

    @Test
    void fileLargerThanFiveMbIsRejected() {
        byte[] tooLarge = new byte[(5 * 1024 * 1024) + 1];

        assertThatThrownBy(() -> imageService.upload(imageFile("large.jpg", tooLarge)))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("이미지는 5MB 이하만 업로드할 수 있습니다.");
    }

    @Test
    void nonImageContentTypeIsRejected() {
        MockMultipartFile file = new MockMultipartFile(
                "file",
                "memo.txt",
                MediaType.TEXT_PLAIN_VALUE,
                "text".getBytes());

        assertThatThrownBy(() -> imageService.upload(file))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("이미지 파일만 업로드할 수 있습니다.");
    }

    @Test
    void cloudinaryFailureIsWrapped() throws Exception {
        MockMultipartFile file = imageFile("review.jpg", "image".getBytes());
        when(cloudinary.uploader()).thenReturn(uploader);
        when(uploader.upload(any(byte[].class), anyMap())).thenThrow(new RuntimeException("cloudinary down"));

        assertThatThrownBy(() -> imageService.upload(file))
                .isInstanceOf(ImageUploadException.class)
                .hasMessage("이미지 업로드에 실패했습니다.");
    }

    private MockMultipartFile imageFile(String filename, byte[] content) {
        return new MockMultipartFile("file", filename, MediaType.IMAGE_JPEG_VALUE, content);
    }
}
