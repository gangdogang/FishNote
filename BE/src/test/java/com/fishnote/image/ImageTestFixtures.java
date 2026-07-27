package com.fishnote.image;

import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.Arrays;
import java.util.Base64;
import java.util.Iterator;
import java.util.zip.CRC32;
import javax.imageio.IIOImage;
import javax.imageio.ImageIO;
import javax.imageio.ImageWriteParam;
import javax.imageio.ImageWriter;
import javax.imageio.stream.ImageOutputStream;

final class ImageTestFixtures {

    private static final byte[] ONE_PIXEL_WEBP = Base64.getDecoder().decode(
            "UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA");
    private static final byte[] ONE_PIXEL_LOSSLESS_WEBP = Base64.getDecoder().decode(
            "UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA==");
    private static final byte[] ONE_PIXEL_ALPHA_WEBP = Base64.getDecoder().decode(
            "UklGRkoAAABXRUJQVlA4WAoAAAAQAAAAAAAAAAAAQUxQSAwAAAARBxAR/Q9ERP8DAABWUDggGAAAABQBAJ0BKgEAAQAAAP4AAA3AAP7mtQAAAA==");

    private ImageTestFixtures() {
    }

    static byte[] imageBytes(String format, int width, int height) throws IOException {
        BufferedImage image = new BufferedImage(width, height, BufferedImage.TYPE_INT_RGB);
        ByteArrayOutputStream output = new ByteArrayOutputStream();
        if (!ImageIO.write(image, format, output)) {
            throw new IllegalStateException("테스트 이미지를 만들 수 없습니다: " + format);
        }
        return output.toByteArray();
    }

    static byte[] progressiveJpegBytes(int width, int height) throws IOException {
        BufferedImage image = new BufferedImage(width, height, BufferedImage.TYPE_INT_RGB);
        Iterator<ImageWriter> writers = ImageIO.getImageWritersByFormatName("jpeg");
        if (!writers.hasNext()) {
            throw new IllegalStateException("JPEG writer를 찾을 수 없습니다.");
        }

        ImageWriter writer = writers.next();
        ByteArrayOutputStream output = new ByteArrayOutputStream();
        try (ImageOutputStream imageOutput = ImageIO.createImageOutputStream(output)) {
            writer.setOutput(imageOutput);
            ImageWriteParam parameters = writer.getDefaultWriteParam();
            parameters.setProgressiveMode(ImageWriteParam.MODE_DEFAULT);
            writer.write(null, new IIOImage(image, null, null), parameters);
        } finally {
            writer.dispose();
        }
        return output.toByteArray();
    }

    static byte[] animatedGifBytes() throws IOException {
        Iterator<ImageWriter> writers = ImageIO.getImageWritersByFormatName("gif");
        if (!writers.hasNext()) {
            throw new IllegalStateException("GIF writer를 찾을 수 없습니다.");
        }

        ImageWriter writer = writers.next();
        ByteArrayOutputStream output = new ByteArrayOutputStream();
        try (ImageOutputStream imageOutput = ImageIO.createImageOutputStream(output)) {
            writer.setOutput(imageOutput);
            writer.prepareWriteSequence(null);
            writer.writeToSequence(
                    new IIOImage(new BufferedImage(1, 1, BufferedImage.TYPE_INT_RGB), null, null),
                    writer.getDefaultWriteParam());
            writer.writeToSequence(
                    new IIOImage(new BufferedImage(20, 20, BufferedImage.TYPE_INT_RGB), null, null),
                    writer.getDefaultWriteParam());
            writer.endWriteSequence();
        } finally {
            writer.dispose();
        }
        return output.toByteArray();
    }

    static byte[] apngBytes() throws IOException {
        byte[] png = imageBytes("png", 1, 1);
        byte[] animationControl = pngChunk("acTL", new byte[] {0, 0, 0, 1, 0, 0, 0, 0});
        ByteArrayOutputStream output = new ByteArrayOutputStream(png.length + animationControl.length);
        // PNG signature + the required first IHDR chunk.
        output.write(png, 0, 33);
        output.write(animationControl);
        output.write(png, 33, png.length - 33);
        return output.toByteArray();
    }

    static byte[] corruptPngRasterWithValidChunkCrc() throws IOException {
        byte[] png = imageBytes("png", 2, 2);
        int offset = 8;
        while (offset + 12 <= png.length) {
            int dataLength = readUnsignedIntBigEndian(png, offset);
            int dataOffset = offset + 8;
            int crcOffset = dataOffset + dataLength;
            if (png[offset + 4] == 'I'
                    && png[offset + 5] == 'D'
                    && png[offset + 6] == 'A'
                    && png[offset + 7] == 'T') {
                Arrays.fill(png, dataOffset, crcOffset, (byte) 0x55);
                CRC32 crc = new CRC32();
                crc.update(png, offset + 4, 4 + dataLength);
                writeUnsignedIntBigEndian(png, crcOffset, crc.getValue());
                return png;
            }
            offset = crcOffset + 4;
        }
        throw new IllegalStateException("PNG IDAT chunk를 찾을 수 없습니다.");
    }

    static byte[] animatedWebpBytes() throws IOException {
        byte[] animationChunk = riffChunk("ANIM", new byte[6]);
        return insertWebpChunk(animationChunk);
    }

    static byte[] animationFlagWebpBytes() throws IOException {
        byte[] extendedHeader = new byte[10];
        extendedHeader[0] = 0x02;
        return insertWebpChunk(riffChunk("VP8X", extendedHeader));
    }

    static byte[] onePixelWebp() {
        return ONE_PIXEL_WEBP.clone();
    }

    static byte[] onePixelLosslessWebp() {
        return ONE_PIXEL_LOSSLESS_WEBP.clone();
    }

    static byte[] onePixelAlphaWebp() {
        return ONE_PIXEL_ALPHA_WEBP.clone();
    }

    static byte[] withoutLastBytes(byte[] source, int count) {
        return Arrays.copyOf(source, source.length - count);
    }

    private static byte[] insertWebpChunk(byte[] chunk) throws IOException {
        ByteArrayOutputStream output = new ByteArrayOutputStream(ONE_PIXEL_WEBP.length + chunk.length);
        output.write(ONE_PIXEL_WEBP, 0, 12);
        output.write(chunk);
        output.write(ONE_PIXEL_WEBP, 12, ONE_PIXEL_WEBP.length - 12);
        byte[] result = output.toByteArray();
        writeUnsignedIntLittleEndian(result, 4, result.length - 8L);
        return result;
    }

    private static byte[] pngChunk(String type, byte[] data) throws IOException {
        ByteArrayOutputStream output = new ByteArrayOutputStream(12 + data.length);
        writeUnsignedIntBigEndian(output, data.length);
        byte[] typeBytes = type.getBytes(java.nio.charset.StandardCharsets.US_ASCII);
        output.write(typeBytes);
        output.write(data);
        CRC32 crc = new CRC32();
        crc.update(typeBytes);
        crc.update(data);
        writeUnsignedIntBigEndian(output, crc.getValue());
        return output.toByteArray();
    }

    private static byte[] riffChunk(String type, byte[] data) throws IOException {
        ByteArrayOutputStream output = new ByteArrayOutputStream(8 + data.length + (data.length & 1));
        output.write(type.getBytes(java.nio.charset.StandardCharsets.US_ASCII));
        writeUnsignedIntLittleEndian(output, data.length);
        output.write(data);
        if ((data.length & 1) != 0) {
            output.write(0);
        }
        return output.toByteArray();
    }

    private static void writeUnsignedIntBigEndian(ByteArrayOutputStream output, long value) {
        output.write((int) (value >>> 24) & 0xFF);
        output.write((int) (value >>> 16) & 0xFF);
        output.write((int) (value >>> 8) & 0xFF);
        output.write((int) value & 0xFF);
    }

    private static void writeUnsignedIntLittleEndian(ByteArrayOutputStream output, long value) {
        output.write((int) value & 0xFF);
        output.write((int) (value >>> 8) & 0xFF);
        output.write((int) (value >>> 16) & 0xFF);
        output.write((int) (value >>> 24) & 0xFF);
    }

    private static void writeUnsignedIntLittleEndian(byte[] bytes, int offset, long value) {
        bytes[offset] = (byte) value;
        bytes[offset + 1] = (byte) (value >>> 8);
        bytes[offset + 2] = (byte) (value >>> 16);
        bytes[offset + 3] = (byte) (value >>> 24);
    }

    private static int readUnsignedIntBigEndian(byte[] bytes, int offset) {
        return ((bytes[offset] & 0xFF) << 24)
                | ((bytes[offset + 1] & 0xFF) << 16)
                | ((bytes[offset + 2] & 0xFF) << 8)
                | (bytes[offset + 3] & 0xFF);
    }

    private static void writeUnsignedIntBigEndian(byte[] bytes, int offset, long value) {
        bytes[offset] = (byte) (value >>> 24);
        bytes[offset + 1] = (byte) (value >>> 16);
        bytes[offset + 2] = (byte) (value >>> 8);
        bytes[offset + 3] = (byte) value;
    }
}
