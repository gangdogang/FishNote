package com.fishnote.image;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.util.Iterator;
import java.util.Locale;
import java.util.Map;
import java.util.zip.CRC32;
import javax.imageio.ImageIO;
import javax.imageio.ImageReadParam;
import javax.imageio.ImageReader;
import javax.imageio.stream.ImageInputStream;
import javax.imageio.stream.MemoryCacheImageInputStream;

final class ImageMetadataInspector {

    private static final String INVALID_IMAGE_MESSAGE = "지원하는 이미지 파일만 업로드할 수 있습니다.";
    private static final int MAX_CONTAINER_PARTS = 10_000;
    private static final Map<String, String> FORMAT_CONTENT_TYPES = Map.of(
            "jpeg", "image/jpeg",
            "png", "image/png",
            "gif", "image/gif",
            "webp", "image/webp");

    private ImageMetadataInspector() {
    }

    static ImageMetadata inspect(byte[] bytes, String suppliedContentType) {
        try {
            String format = detectFormat(bytes);
            String expectedContentType = FORMAT_CONTENT_TYPES.get(format);
            if (expectedContentType == null
                    || !expectedContentType.equals(normalizeContentType(suppliedContentType))) {
                throw invalidImage();
            }

            ContainerMetadata container = validateContainer(format, bytes);
            try (ImageInputStream input =
                    new MemoryCacheImageInputStream(new ByteArrayInputStream(bytes))) {
                Iterator<ImageReader> readers = ImageIO.getImageReaders(input);
                if (!readers.hasNext()) {
                    throw invalidImage();
                }

                ImageReader reader = readers.next();
                try {
                    reader.setInput(input, true, true);
                    if (!format.equals(normalizeFormat(reader.getFormatName()))) {
                        throw invalidImage();
                    }

                    int readerWidth = reader.getWidth(0);
                    int readerHeight = reader.getHeight(0);
                    if (readerWidth <= 0 || readerHeight <= 0) {
                        throw invalidImage();
                    }
                    if (container.readerDimensionsMustMatch()
                            && (readerWidth != container.width()
                                    || readerHeight != container.height())) {
                        throw invalidImage();
                    }

                    // GIF readers may expose the first frame bounds rather than the logical canvas.
                    return new ImageMetadata(
                            format,
                            Math.max(readerWidth, container.width()),
                            Math.max(readerHeight, container.height()));
                } finally {
                    reader.dispose();
                }
            }
        } catch (IOException | RuntimeException ex) {
            if (ex instanceof IllegalArgumentException illegalArgumentException
                    && INVALID_IMAGE_MESSAGE.equals(illegalArgumentException.getMessage())) {
                throw illegalArgumentException;
            }
            throw invalidImage();
        }
    }

    /**
     * Decodes a single heavily subsampled pixel after the caller has enforced dimension and
     * pixel-count limits. Metadata-only readers can accept a complete container whose compressed
     * raster is corrupt, so this pass must also finish before bytes are sent to Cloudinary.
     */
    static void verifyDecodable(byte[] bytes, ImageMetadata metadata) {
        try (ImageInputStream input =
                new MemoryCacheImageInputStream(new ByteArrayInputStream(bytes))) {
            Iterator<ImageReader> readers = ImageIO.getImageReaders(input);
            if (!readers.hasNext()) {
                throw invalidImage();
            }

            ImageReader reader = readers.next();
            try {
                reader.setInput(input, true, true);
                if (!metadata.format().equals(normalizeFormat(reader.getFormatName()))) {
                    throw invalidImage();
                }
                ImageReadParam parameters = reader.getDefaultReadParam();
                parameters.setSourceSubsampling(
                        Math.max(1, metadata.width()),
                        Math.max(1, metadata.height()),
                        0,
                        0);
                if (reader.read(0, parameters) == null) {
                    throw invalidImage();
                }
            } finally {
                reader.dispose();
            }
        } catch (IOException | RuntimeException ex) {
            if (ex instanceof IllegalArgumentException illegalArgumentException
                    && INVALID_IMAGE_MESSAGE.equals(illegalArgumentException.getMessage())) {
                throw illegalArgumentException;
            }
            throw invalidImage();
        }
    }

    private static String detectFormat(byte[] bytes) {
        if (startsWith(bytes, 0xFF, 0xD8, 0xFF)) {
            return "jpeg";
        }
        if (startsWith(bytes, 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A)) {
            return "png";
        }
        if (startsWithAscii(bytes, 0, "GIF87a") || startsWithAscii(bytes, 0, "GIF89a")) {
            return "gif";
        }
        if (startsWithAscii(bytes, 0, "RIFF")
                && bytes.length >= 12
                && startsWithAscii(bytes, 8, "WEBP")) {
            return "webp";
        }
        throw invalidImage();
    }

    private static ContainerMetadata validateContainer(String format, byte[] bytes) {
        return switch (format) {
            case "jpeg" -> validateJpeg(bytes);
            case "png" -> validatePng(bytes);
            case "gif" -> validateGif(bytes);
            case "webp" -> validateWebp(bytes);
            default -> throw invalidImage();
        };
    }

    private static ContainerMetadata validatePng(byte[] bytes) {
        int offset = 8;
        int partCount = 0;
        boolean hasHeader = false;
        long imageDataBytes = 0;
        int width = 0;
        int height = 0;

        while (offset < bytes.length) {
            if (++partCount > MAX_CONTAINER_PARTS || !hasRange(bytes, offset, 12)) {
                throw invalidImage();
            }

            long dataLength = readUnsignedIntBigEndian(bytes, offset);
            if (dataLength > bytes.length - offset - 12L) {
                throw invalidImage();
            }
            int dataOffset = offset + 8;
            int crcOffset = dataOffset + (int) dataLength;
            int nextOffset = crcOffset + 4;
            if (!isPngChunkType(bytes, offset + 4)) {
                throw invalidImage();
            }

            CRC32 crc = new CRC32();
            crc.update(bytes, offset + 4, 4 + (int) dataLength);
            if (crc.getValue() != readUnsignedIntBigEndian(bytes, crcOffset)) {
                throw invalidImage();
            }

            if (matchesAscii(bytes, offset + 4, "IHDR")) {
                if (hasHeader || partCount != 1 || dataLength != 13) {
                    throw invalidImage();
                }
                long unsignedWidth = readUnsignedIntBigEndian(bytes, dataOffset);
                long unsignedHeight = readUnsignedIntBigEndian(bytes, dataOffset + 4);
                if (unsignedWidth == 0
                        || unsignedHeight == 0
                        || unsignedWidth > Integer.MAX_VALUE
                        || unsignedHeight > Integer.MAX_VALUE) {
                    throw invalidImage();
                }
                width = (int) unsignedWidth;
                height = (int) unsignedHeight;
                validatePngHeader(bytes, dataOffset);
                hasHeader = true;
            } else if (!hasHeader) {
                throw invalidImage();
            } else if (matchesAscii(bytes, offset + 4, "acTL")
                    || matchesAscii(bytes, offset + 4, "fcTL")
                    || matchesAscii(bytes, offset + 4, "fdAT")) {
                // Animated PNG is intentionally outside the upload contract.
                throw invalidImage();
            } else if (matchesAscii(bytes, offset + 4, "IDAT")) {
                imageDataBytes += dataLength;
            } else if (matchesAscii(bytes, offset + 4, "IEND")) {
                if (dataLength != 0 || imageDataBytes == 0 || nextOffset != bytes.length) {
                    throw invalidImage();
                }
                return new ContainerMetadata(width, height, true);
            }

            offset = nextOffset;
        }
        throw invalidImage();
    }

    private static void validatePngHeader(byte[] bytes, int dataOffset) {
        int bitDepth = bytes[dataOffset + 8] & 0xFF;
        int colorType = bytes[dataOffset + 9] & 0xFF;
        boolean validBitDepth = switch (colorType) {
            case 0 -> bitDepth == 1 || bitDepth == 2 || bitDepth == 4 || bitDepth == 8 || bitDepth == 16;
            case 2, 4, 6 -> bitDepth == 8 || bitDepth == 16;
            case 3 -> bitDepth == 1 || bitDepth == 2 || bitDepth == 4 || bitDepth == 8;
            default -> false;
        };
        if (!validBitDepth
                || bytes[dataOffset + 10] != 0
                || bytes[dataOffset + 11] != 0
                || (bytes[dataOffset + 12] != 0 && bytes[dataOffset + 12] != 1)) {
            throw invalidImage();
        }
    }

    private static ContainerMetadata validateGif(byte[] bytes) {
        if (!hasRange(bytes, 0, 13)) {
            throw invalidImage();
        }
        int canvasWidth = readUnsignedShortLittleEndian(bytes, 6);
        int canvasHeight = readUnsignedShortLittleEndian(bytes, 8);
        if (canvasWidth == 0 || canvasHeight == 0) {
            throw invalidImage();
        }

        int packed = bytes[10] & 0xFF;
        int offset = 13;
        if ((packed & 0x80) != 0) {
            offset = skipGifColorTable(bytes, offset, packed);
        }

        int partCount = 0;
        int imageCount = 0;
        while (offset < bytes.length) {
            if (++partCount > MAX_CONTAINER_PARTS) {
                throw invalidImage();
            }
            int introducer = bytes[offset] & 0xFF;
            if (introducer == 0x21) {
                if (!hasRange(bytes, offset, 2)) {
                    throw invalidImage();
                }
                int label = bytes[offset + 1] & 0xFF;
                int dataOffset = offset + 2;
                if (label == 0xFF && isGifLoopExtension(bytes, dataOffset)) {
                    throw invalidImage();
                }
                offset = skipGifSubBlocks(bytes, dataOffset, false);
            } else if (introducer == 0x2C) {
                if (++imageCount != 1 || !hasRange(bytes, offset, 10)) {
                    throw invalidImage();
                }
                int left = readUnsignedShortLittleEndian(bytes, offset + 1);
                int top = readUnsignedShortLittleEndian(bytes, offset + 3);
                int frameWidth = readUnsignedShortLittleEndian(bytes, offset + 5);
                int frameHeight = readUnsignedShortLittleEndian(bytes, offset + 7);
                if (frameWidth == 0
                        || frameHeight == 0
                        || (long) left + frameWidth > canvasWidth
                        || (long) top + frameHeight > canvasHeight) {
                    throw invalidImage();
                }

                int framePacked = bytes[offset + 9] & 0xFF;
                offset += 10;
                if ((framePacked & 0x80) != 0) {
                    offset = skipGifColorTable(bytes, offset, framePacked);
                }
                if (!hasRange(bytes, offset, 1)) {
                    throw invalidImage();
                }
                int minimumCodeSize = bytes[offset] & 0xFF;
                if (minimumCodeSize < 2 || minimumCodeSize > 8) {
                    throw invalidImage();
                }
                offset = skipGifSubBlocks(bytes, offset + 1, true);
            } else if (introducer == 0x3B) {
                if (imageCount != 1 || offset + 1 != bytes.length) {
                    throw invalidImage();
                }
                return new ContainerMetadata(canvasWidth, canvasHeight, false);
            } else {
                throw invalidImage();
            }
        }
        throw invalidImage();
    }

    private static int skipGifColorTable(byte[] bytes, int offset, int packed) {
        int entryCount = 1 << ((packed & 0x07) + 1);
        int byteCount = Math.multiplyExact(entryCount, 3);
        if (!hasRange(bytes, offset, byteCount)) {
            throw invalidImage();
        }
        return offset + byteCount;
    }

    private static int skipGifSubBlocks(byte[] bytes, int offset, boolean requireData) {
        int blockCount = 0;
        long dataBytes = 0;
        while (offset < bytes.length) {
            if (++blockCount > MAX_CONTAINER_PARTS) {
                throw invalidImage();
            }
            int blockSize = bytes[offset] & 0xFF;
            offset++;
            if (blockSize == 0) {
                if (requireData && dataBytes == 0) {
                    throw invalidImage();
                }
                return offset;
            }
            if (!hasRange(bytes, offset, blockSize)) {
                throw invalidImage();
            }
            dataBytes += blockSize;
            offset += blockSize;
        }
        throw invalidImage();
    }

    private static boolean isGifLoopExtension(byte[] bytes, int dataOffset) {
        if (!hasRange(bytes, dataOffset, 12) || (bytes[dataOffset] & 0xFF) != 11) {
            return false;
        }
        return matchesAscii(bytes, dataOffset + 1, "NETSCAPE2.0")
                || matchesAscii(bytes, dataOffset + 1, "ANIMEXTS1.0");
    }

    private static ContainerMetadata validateJpeg(byte[] bytes) {
        int offset = 2;
        int partCount = 0;
        boolean hasStartOfFrame = false;
        boolean hasScan = false;
        boolean hasEntropyData = false;
        int width = 0;
        int height = 0;

        while (offset < bytes.length) {
            if (++partCount > MAX_CONTAINER_PARTS || (bytes[offset] & 0xFF) != 0xFF) {
                throw invalidImage();
            }
            int markerStart = offset;
            while (offset < bytes.length && (bytes[offset] & 0xFF) == 0xFF) {
                offset++;
            }
            if (offset >= bytes.length) {
                throw invalidImage();
            }
            int marker = bytes[offset++] & 0xFF;
            if (marker == 0x00 || marker == 0xD8) {
                throw invalidImage();
            }
            if (marker == 0xD9) {
                if (!hasStartOfFrame || !hasScan || !hasEntropyData || offset != bytes.length) {
                    throw invalidImage();
                }
                return new ContainerMetadata(width, height, true);
            }
            if (marker == 0x01 || (marker >= 0xD0 && marker <= 0xD7)) {
                continue;
            }
            if (!hasRange(bytes, offset, 2)) {
                throw invalidImage();
            }
            int segmentLength = readUnsignedShortBigEndian(bytes, offset);
            if (segmentLength < 2 || !hasRange(bytes, offset, segmentLength)) {
                throw invalidImage();
            }
            int dataOffset = offset + 2;
            int segmentEnd = offset + segmentLength;

            if (isStartOfFrame(marker)) {
                if (hasStartOfFrame || segmentLength < 8) {
                    throw invalidImage();
                }
                int componentCount = bytes[dataOffset + 5] & 0xFF;
                if (componentCount == 0 || segmentLength != 8 + (3 * componentCount)) {
                    throw invalidImage();
                }
                height = readUnsignedShortBigEndian(bytes, dataOffset + 1);
                width = readUnsignedShortBigEndian(bytes, dataOffset + 3);
                if (width == 0 || height == 0) {
                    throw invalidImage();
                }
                hasStartOfFrame = true;
            }

            if (marker == 0xDA) {
                if (!hasStartOfFrame || segmentLength < 6) {
                    throw invalidImage();
                }
                int componentCount = bytes[dataOffset] & 0xFF;
                if (componentCount == 0 || segmentLength != 6 + (2 * componentCount)) {
                    throw invalidImage();
                }
                hasScan = true;
                JpegScan scan = findNextJpegMarker(bytes, segmentEnd);
                hasEntropyData |= scan.hasEntropyData();
                offset = scan.nextMarkerOffset();
            } else {
                offset = segmentEnd;
            }

            if (offset == markerStart) {
                throw invalidImage();
            }
        }
        throw invalidImage();
    }

    private static JpegScan findNextJpegMarker(byte[] bytes, int offset) {
        boolean hasEntropyData = false;
        while (offset < bytes.length) {
            if ((bytes[offset] & 0xFF) != 0xFF) {
                hasEntropyData = true;
                offset++;
                continue;
            }
            int markerStart = offset;
            while (offset < bytes.length && (bytes[offset] & 0xFF) == 0xFF) {
                offset++;
            }
            if (offset >= bytes.length) {
                throw invalidImage();
            }
            int marker = bytes[offset] & 0xFF;
            if (marker == 0x00 || (marker >= 0xD0 && marker <= 0xD7)) {
                hasEntropyData |= marker == 0x00;
                offset++;
                continue;
            }
            return new JpegScan(markerStart, hasEntropyData);
        }
        throw invalidImage();
    }

    private static boolean isStartOfFrame(int marker) {
        return (marker >= 0xC0 && marker <= 0xC3)
                || (marker >= 0xC5 && marker <= 0xC7)
                || (marker >= 0xC9 && marker <= 0xCB)
                || (marker >= 0xCD && marker <= 0xCF);
    }

    private static ContainerMetadata validateWebp(byte[] bytes) {
        if (!hasRange(bytes, 0, 20)) {
            throw invalidImage();
        }
        long riffSize = readUnsignedIntLittleEndian(bytes, 4);
        if (riffSize + 8L != bytes.length) {
            throw invalidImage();
        }

        int offset = 12;
        int partCount = 0;
        int imagePayloadCount = 0;
        int payloadWidth = 0;
        int payloadHeight = 0;
        int canvasWidth = 0;
        int canvasHeight = 0;
        boolean hasExtendedHeader = false;

        while (offset < bytes.length) {
            if (++partCount > MAX_CONTAINER_PARTS || !hasRange(bytes, offset, 8)) {
                throw invalidImage();
            }
            long chunkSize = readUnsignedIntLittleEndian(bytes, offset + 4);
            long paddedSize = chunkSize + (chunkSize & 1L);
            if (paddedSize > bytes.length - offset - 8L) {
                throw invalidImage();
            }
            int dataOffset = offset + 8;
            int nextOffset = (int) (dataOffset + paddedSize);

            if (matchesAscii(bytes, offset, "VP8X")) {
                if (hasExtendedHeader || imagePayloadCount != 0 || chunkSize != 10) {
                    throw invalidImage();
                }
                int flags = bytes[dataOffset] & 0xFF;
                if ((flags & 0xC3) != 0) {
                    // Reserved bits and the animation feature bit must remain unset.
                    throw invalidImage();
                }
                canvasWidth = 1 + readUnsignedInt24LittleEndian(bytes, dataOffset + 4);
                canvasHeight = 1 + readUnsignedInt24LittleEndian(bytes, dataOffset + 7);
                hasExtendedHeader = true;
            } else if (matchesAscii(bytes, offset, "ANIM")
                    || matchesAscii(bytes, offset, "ANMF")) {
                throw invalidImage();
            } else if (matchesAscii(bytes, offset, "VP8 ")) {
                if (++imagePayloadCount != 1 || chunkSize <= 10) {
                    throw invalidImage();
                }
                if ((bytes[dataOffset] & 0x01) != 0
                        || !startsWithAt(bytes, dataOffset + 3, 0x9D, 0x01, 0x2A)) {
                    throw invalidImage();
                }
                payloadWidth = readUnsignedShortLittleEndian(bytes, dataOffset + 6) & 0x3FFF;
                payloadHeight = readUnsignedShortLittleEndian(bytes, dataOffset + 8) & 0x3FFF;
            } else if (matchesAscii(bytes, offset, "VP8L")) {
                if (++imagePayloadCount != 1 || chunkSize <= 5 || (bytes[dataOffset] & 0xFF) != 0x2F) {
                    throw invalidImage();
                }
                int byte1 = bytes[dataOffset + 1] & 0xFF;
                int byte2 = bytes[dataOffset + 2] & 0xFF;
                int byte3 = bytes[dataOffset + 3] & 0xFF;
                int byte4 = bytes[dataOffset + 4] & 0xFF;
                if ((byte4 & 0xE0) != 0) {
                    throw invalidImage();
                }
                payloadWidth = 1 + byte1 + ((byte2 & 0x3F) << 8);
                payloadHeight = 1 + (byte2 >>> 6) + (byte3 << 2) + ((byte4 & 0x0F) << 10);
            }

            offset = nextOffset;
        }

        if (offset != bytes.length
                || imagePayloadCount != 1
                || payloadWidth <= 0
                || payloadHeight <= 0) {
            throw invalidImage();
        }
        if (hasExtendedHeader
                && (canvasWidth != payloadWidth || canvasHeight != payloadHeight)) {
            throw invalidImage();
        }
        return new ContainerMetadata(payloadWidth, payloadHeight, true);
    }

    private static String normalizeFormat(String formatName) {
        String format = formatName.toLowerCase(Locale.ROOT);
        return "jpg".equals(format) ? "jpeg" : format;
    }

    private static String normalizeContentType(String contentType) {
        if (contentType == null) {
            throw invalidImage();
        }
        int parameterStart = contentType.indexOf(';');
        String mediaType = parameterStart < 0 ? contentType : contentType.substring(0, parameterStart);
        return mediaType.trim().toLowerCase(Locale.ROOT);
    }

    private static boolean startsWith(byte[] bytes, int... signature) {
        return startsWithAt(bytes, 0, signature);
    }

    private static boolean startsWithAt(byte[] bytes, int offset, int... signature) {
        if (!hasRange(bytes, offset, signature.length)) {
            return false;
        }
        for (int index = 0; index < signature.length; index++) {
            if ((bytes[offset + index] & 0xFF) != signature[index]) {
                return false;
            }
        }
        return true;
    }

    private static boolean startsWithAscii(byte[] bytes, int offset, String signature) {
        return matchesAscii(bytes, offset, signature);
    }

    private static boolean matchesAscii(byte[] bytes, int offset, String expected) {
        if (!hasRange(bytes, offset, expected.length())) {
            return false;
        }
        for (int index = 0; index < expected.length(); index++) {
            if ((bytes[offset + index] & 0xFF) != expected.charAt(index)) {
                return false;
            }
        }
        return true;
    }

    private static boolean isPngChunkType(byte[] bytes, int offset) {
        if (!hasRange(bytes, offset, 4)) {
            return false;
        }
        for (int index = 0; index < 4; index++) {
            int value = bytes[offset + index] & 0xFF;
            if (!((value >= 'A' && value <= 'Z') || (value >= 'a' && value <= 'z'))) {
                return false;
            }
        }
        return true;
    }

    private static boolean hasRange(byte[] bytes, int offset, long length) {
        return offset >= 0 && length >= 0 && offset <= bytes.length && length <= bytes.length - offset;
    }

    private static int readUnsignedShortBigEndian(byte[] bytes, int offset) {
        if (!hasRange(bytes, offset, 2)) {
            throw invalidImage();
        }
        return ((bytes[offset] & 0xFF) << 8) | (bytes[offset + 1] & 0xFF);
    }

    private static int readUnsignedShortLittleEndian(byte[] bytes, int offset) {
        if (!hasRange(bytes, offset, 2)) {
            throw invalidImage();
        }
        return (bytes[offset] & 0xFF) | ((bytes[offset + 1] & 0xFF) << 8);
    }

    private static long readUnsignedIntBigEndian(byte[] bytes, int offset) {
        if (!hasRange(bytes, offset, 4)) {
            throw invalidImage();
        }
        return ((long) (bytes[offset] & 0xFF) << 24)
                | ((long) (bytes[offset + 1] & 0xFF) << 16)
                | ((long) (bytes[offset + 2] & 0xFF) << 8)
                | (bytes[offset + 3] & 0xFFL);
    }

    private static long readUnsignedIntLittleEndian(byte[] bytes, int offset) {
        if (!hasRange(bytes, offset, 4)) {
            throw invalidImage();
        }
        return (bytes[offset] & 0xFFL)
                | ((long) (bytes[offset + 1] & 0xFF) << 8)
                | ((long) (bytes[offset + 2] & 0xFF) << 16)
                | ((long) (bytes[offset + 3] & 0xFF) << 24);
    }

    private static int readUnsignedInt24LittleEndian(byte[] bytes, int offset) {
        if (!hasRange(bytes, offset, 3)) {
            throw invalidImage();
        }
        return (bytes[offset] & 0xFF)
                | ((bytes[offset + 1] & 0xFF) << 8)
                | ((bytes[offset + 2] & 0xFF) << 16);
    }

    private static IllegalArgumentException invalidImage() {
        return new IllegalArgumentException(INVALID_IMAGE_MESSAGE);
    }

    record ImageMetadata(String format, int width, int height) {
    }

    private record ContainerMetadata(int width, int height, boolean readerDimensionsMustMatch) {
    }

    private record JpegScan(int nextMarkerOffset, boolean hasEntropyData) {
    }
}
