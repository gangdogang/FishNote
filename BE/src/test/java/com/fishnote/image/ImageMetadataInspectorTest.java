package com.fishnote.image;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.Arrays;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;

class ImageMetadataInspectorTest {

    @Test
    void readsSupportedFormatsWithoutDecodingTheFullRaster() throws Exception {
        assertMetadata(
                ImageTestFixtures.imageBytes("jpeg", 2, 3),
                MediaType.IMAGE_JPEG_VALUE,
                "jpeg",
                2,
                3);
        assertMetadata(
                ImageTestFixtures.imageBytes("png", 3, 4),
                MediaType.IMAGE_PNG_VALUE,
                "png",
                3,
                4);
        assertMetadata(
                ImageTestFixtures.imageBytes("gif", 4, 5),
                MediaType.IMAGE_GIF_VALUE,
                "gif",
                4,
                5);
        assertMetadata(ImageTestFixtures.onePixelWebp(), "image/webp", "webp", 1, 1);
        assertMetadata(ImageTestFixtures.onePixelLosslessWebp(), "image/webp", "webp", 1, 1);
        assertMetadata(ImageTestFixtures.onePixelAlphaWebp(), "image/webp", "webp", 1, 1);
        assertMetadata(
                ImageTestFixtures.progressiveJpegBytes(5, 6),
                MediaType.IMAGE_JPEG_VALUE,
                "jpeg",
                5,
                6);
    }

    @Test
    void contentTypeParametersAreNormalizedButFormatMismatchIsRejected() throws Exception {
        byte[] jpeg = ImageTestFixtures.imageBytes("jpeg", 2, 2);
        assertMetadata(jpeg, "IMAGE/JPEG; charset=binary", "jpeg", 2, 2);

        assertThatThrownBy(() -> ImageMetadataInspector.inspect(jpeg, MediaType.IMAGE_PNG_VALUE))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("지원하는 이미지 파일만 업로드할 수 있습니다.");
    }

    @Test
    void incompleteCorruptAndPolyglotContainersAreRejected() throws Exception {
        byte[] png = ImageTestFixtures.imageBytes("png", 1, 1);
        byte[] corruptPng = png.clone();
        corruptPng[32] ^= 0x01;
        byte[] jpeg = ImageTestFixtures.imageBytes("jpeg", 1, 1);
        byte[] gif = ImageTestFixtures.imageBytes("gif", 1, 1);
        byte[] webp = ImageTestFixtures.onePixelWebp();

        assertInvalid(Arrays.copyOf(png, 33), MediaType.IMAGE_PNG_VALUE);
        assertInvalid(corruptPng, MediaType.IMAGE_PNG_VALUE);
        assertInvalid(ImageTestFixtures.withoutLastBytes(jpeg, 2), MediaType.IMAGE_JPEG_VALUE);
        assertInvalid(ImageTestFixtures.withoutLastBytes(gif, 1), MediaType.IMAGE_GIF_VALUE);
        assertInvalid(ImageTestFixtures.withoutLastBytes(webp, 1), "image/webp");

        byte[] pngWithTrailingBytes = Arrays.copyOf(png, png.length + 1);
        assertInvalid(pngWithTrailingBytes, MediaType.IMAGE_PNG_VALUE);
    }

    @Test
    void animatedImageContainersAreRejected() throws Exception {
        assertInvalid(ImageTestFixtures.animatedGifBytes(), MediaType.IMAGE_GIF_VALUE);
        assertInvalid(ImageTestFixtures.apngBytes(), MediaType.IMAGE_PNG_VALUE);
        assertInvalid(ImageTestFixtures.animatedWebpBytes(), "image/webp");
        assertInvalid(ImageTestFixtures.animationFlagWebpBytes(), "image/webp");
    }

    @Test
    void corruptCompressedRasterIsRejectedByBoundedDecodePass() throws Exception {
        byte[] corruptPng = ImageTestFixtures.corruptPngRasterWithValidChunkCrc();
        ImageMetadataInspector.ImageMetadata metadata =
                ImageMetadataInspector.inspect(corruptPng, MediaType.IMAGE_PNG_VALUE);

        assertThatThrownBy(() -> ImageMetadataInspector.verifyDecodable(corruptPng, metadata))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("지원하는 이미지 파일만 업로드할 수 있습니다.");
    }

    private void assertInvalid(byte[] bytes, String contentType) {
        assertThatThrownBy(() -> ImageMetadataInspector.inspect(bytes, contentType))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("지원하는 이미지 파일만 업로드할 수 있습니다.");
    }

    private void assertMetadata(
            byte[] bytes,
            String contentType,
            String format,
            int width,
            int height) {
        ImageMetadataInspector.ImageMetadata metadata =
                ImageMetadataInspector.inspect(bytes, contentType);
        assertThat(metadata.format()).isEqualTo(format);
        assertThat(metadata.width()).isEqualTo(width);
        assertThat(metadata.height()).isEqualTo(height);
        ImageMetadataInspector.verifyDecodable(bytes, metadata);
    }
}
