package com.fishnote.common;

public class InvalidCursorException extends RuntimeException {

    public InvalidCursorException() {
        super("cursor 값이 올바르지 않습니다.");
    }
}
