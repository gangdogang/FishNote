package com.fishnote.common;

import com.fishnote.image.ImageUploadException;
import com.fishnote.user.KakaoOAuthException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.ConstraintViolationException;
import java.time.OffsetDateTime;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.HttpMediaTypeNotSupportedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.multipart.MaxUploadSizeExceededException;
import org.springframework.web.multipart.MultipartException;

@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    @ExceptionHandler(InvalidCursorException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public CodedErrorResponse handleInvalidCursor(
            InvalidCursorException ex,
            HttpServletRequest request) {
        return new CodedErrorResponse(
                OffsetDateTime.now(),
                HttpStatus.BAD_REQUEST.value(),
                HttpStatus.BAD_REQUEST.getReasonPhrase(),
                "INVALID_CURSOR",
                ex.getMessage(),
                Map.of("cursor", "Base64URL cursor의 형식 또는 정렬 기준이 올바르지 않습니다."),
                traceId(request),
                request.getRequestURI());
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public CodedErrorResponse handleValidation(MethodArgumentNotValidException ex, HttpServletRequest request) {
        Map<String, String> fields = new LinkedHashMap<>();
        ex.getBindingResult().getFieldErrors().forEach(fieldError -> fields.putIfAbsent(
                fieldError.getField(),
                fieldError.getDefaultMessage() == null
                        ? "올바르지 않은 값입니다."
                        : fieldError.getDefaultMessage()));
        String message = fields.values().stream().findFirst().orElse("요청값이 올바르지 않습니다.");
        return error(HttpStatus.BAD_REQUEST, "VALIDATION_FAILED", message, fields, request);
    }

    @ExceptionHandler({ConstraintViolationException.class, IllegalArgumentException.class})
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public CodedErrorResponse handleBadRequest(Exception ex, HttpServletRequest request) {
        return error(HttpStatus.BAD_REQUEST, "INVALID_QUERY_PARAMETER", ex.getMessage(), Map.of(), request);
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public CodedErrorResponse handleNotReadable(HttpMessageNotReadableException ex, HttpServletRequest request) {
        return error(
                HttpStatus.BAD_REQUEST,
                "INVALID_REQUEST_BODY",
                "요청 본문을 해석할 수 없습니다.",
                Map.of(),
                request);
    }

    @ExceptionHandler(MissingServletRequestParameterException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public CodedErrorResponse handleMissingRequestParameter(
            MissingServletRequestParameterException ex,
            HttpServletRequest request) {
        return error(
                HttpStatus.BAD_REQUEST,
                "MISSING_QUERY_PARAMETER",
                "필수 요청 값이 누락되었습니다.",
                Map.of(ex.getParameterName(), "필수 값입니다."),
                request);
    }

    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public CodedErrorResponse handleTypeMismatch(
            MethodArgumentTypeMismatchException ex,
            HttpServletRequest request) {
        return error(
                HttpStatus.BAD_REQUEST,
                "INVALID_QUERY_PARAMETER",
                "경로 또는 쿼리 값이 올바르지 않습니다.",
                Map.of(ex.getName(), "요청한 형식으로 변환할 수 없습니다."),
                request);
    }

    @ExceptionHandler(HttpMediaTypeNotSupportedException.class)
    @ResponseStatus(HttpStatus.UNSUPPORTED_MEDIA_TYPE)
    public CodedErrorResponse handleUnsupportedMediaType(
            HttpMediaTypeNotSupportedException ex,
            HttpServletRequest request) {
        return error(
                HttpStatus.UNSUPPORTED_MEDIA_TYPE,
                "UNSUPPORTED_MEDIA_TYPE",
                "지원하지 않는 Content-Type입니다.",
                Map.of(),
                request);
    }

    @ExceptionHandler(MaxUploadSizeExceededException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public CodedErrorResponse handleMaxUploadSize(MaxUploadSizeExceededException ex, HttpServletRequest request) {
        return error(
                HttpStatus.BAD_REQUEST,
                "UPLOAD_TOO_LARGE",
                "이미지는 5MB 이하만 업로드할 수 있습니다.",
                Map.of(),
                request);
    }

    @ExceptionHandler(MultipartException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public CodedErrorResponse handleMultipart(MultipartException ex, HttpServletRequest request) {
        return error(
                HttpStatus.BAD_REQUEST,
                "INVALID_MULTIPART_REQUEST",
                "파일 업로드 요청이 올바르지 않습니다.",
                Map.of(),
                request);
    }

    @ExceptionHandler(NotFoundException.class)
    @ResponseStatus(HttpStatus.NOT_FOUND)
    public CodedErrorResponse handleNotFound(NotFoundException ex, HttpServletRequest request) {
        return error(HttpStatus.NOT_FOUND, "NOT_FOUND", ex.getMessage(), Map.of(), request);
    }

    @ExceptionHandler(ForbiddenException.class)
    @ResponseStatus(HttpStatus.FORBIDDEN)
    public CodedErrorResponse handleForbidden(ForbiddenException ex, HttpServletRequest request) {
        return error(HttpStatus.FORBIDDEN, "FORBIDDEN", ex.getMessage(), Map.of(), request);
    }

    @ExceptionHandler(UnauthorizedException.class)
    @ResponseStatus(HttpStatus.UNAUTHORIZED)
    public CodedErrorResponse handleUnauthorized(UnauthorizedException ex, HttpServletRequest request) {
        return error(HttpStatus.UNAUTHORIZED, "UNAUTHORIZED", ex.getMessage(), Map.of(), request);
    }

    @ExceptionHandler(ConflictException.class)
    @ResponseStatus(HttpStatus.CONFLICT)
    public CodedErrorResponse handleConflict(ConflictException ex, HttpServletRequest request) {
        return error(HttpStatus.CONFLICT, "CONFLICT", ex.getMessage(), Map.of(), request);
    }

    @ExceptionHandler(FeatureDisabledException.class)
    @ResponseStatus(HttpStatus.SERVICE_UNAVAILABLE)
    public CodedErrorResponse handleFeatureDisabled(
            FeatureDisabledException ex,
            HttpServletRequest request) {
        return error(
                HttpStatus.SERVICE_UNAVAILABLE,
                "FEATURE_DISABLED",
                ex.getMessage(),
                Map.of(),
                request);
    }

    @ExceptionHandler(KakaoOAuthException.class)
    public ResponseEntity<CodedErrorResponse> handleKakaoOAuth(
            KakaoOAuthException ex,
            HttpServletRequest request) {
        return ResponseEntity
                .status(ex.getStatus())
                .body(error(ex.getStatus(), "KAKAO_OAUTH_ERROR", ex.getMessage(), Map.of(), request));
    }

    @ExceptionHandler(ImageUploadException.class)
    @ResponseStatus(HttpStatus.INTERNAL_SERVER_ERROR)
    public CodedErrorResponse handleImageUpload(ImageUploadException ex, HttpServletRequest request) {
        // Cloudinary SDK exceptions may contain request URLs or response details. Log bounded types only.
        log.error(
                "이미지 업로드 실패: method={}, path={}, errorType={}, causeType={}",
                request.getMethod(),
                request.getRequestURI(),
                ex.getClass().getSimpleName(),
                ex.getCause() == null ? "none" : ex.getCause().getClass().getSimpleName());
        return error(
                HttpStatus.INTERNAL_SERVER_ERROR,
                "IMAGE_UPLOAD_FAILED",
                ex.getMessage(),
                Map.of(),
                request);
    }

    @ExceptionHandler(Exception.class)
    @ResponseStatus(HttpStatus.INTERNAL_SERVER_ERROR)
    public CodedErrorResponse handleServerError(Exception ex, HttpServletRequest request) {
        log.error("처리되지 않은 서버 오류: {} {}", request.getMethod(), request.getRequestURI(), ex);
        return error(
                HttpStatus.INTERNAL_SERVER_ERROR,
                "INTERNAL_SERVER_ERROR",
                "서버 오류가 발생했습니다.",
                Map.of(),
                request);
    }

    private CodedErrorResponse error(
            HttpStatus status,
            String code,
            String message,
            Map<String, String> fieldErrors,
            HttpServletRequest request) {
        return new CodedErrorResponse(
                OffsetDateTime.now(),
                status.value(),
                status.getReasonPhrase(),
                code,
                message,
                Map.copyOf(fieldErrors),
                traceId(request),
                request.getRequestURI());
    }

    private String traceId(HttpServletRequest request) {
        Object existing = request.getAttribute("traceId");
        return existing == null ? UUID.randomUUID().toString() : existing.toString();
    }
}
