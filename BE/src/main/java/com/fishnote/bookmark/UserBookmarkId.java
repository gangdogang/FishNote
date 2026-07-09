package com.fishnote.bookmark;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import java.io.Serializable;
import java.util.Objects;

@Embeddable
public class UserBookmarkId implements Serializable {

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "fish_id", nullable = false)
    private Long fishId;

    protected UserBookmarkId() {
    }

    public UserBookmarkId(Long userId, Long fishId) {
        this.userId = userId;
        this.fishId = fishId;
    }

    public Long getUserId() {
        return userId;
    }

    public Long getFishId() {
        return fishId;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) {
            return true;
        }
        if (!(o instanceof UserBookmarkId that)) {
            return false;
        }
        return Objects.equals(userId, that.userId) && Objects.equals(fishId, that.fishId);
    }

    @Override
    public int hashCode() {
        return Objects.hash(userId, fishId);
    }
}
