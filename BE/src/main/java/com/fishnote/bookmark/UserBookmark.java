package com.fishnote.bookmark;

import com.fishnote.fish.Fish;
import com.fishnote.user.User;
import jakarta.persistence.Column;
import jakarta.persistence.EmbeddedId;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.MapsId;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import java.time.OffsetDateTime;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "user_bookmark")
@Getter
@Setter
@NoArgsConstructor
public class UserBookmark {

    @EmbeddedId
    private UserBookmarkId id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @MapsId("userId")
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @MapsId("fishId")
    @JoinColumn(name = "fish_id", nullable = false)
    private Fish fish;

    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    public UserBookmark(User user, Fish fish) {
        this.id = new UserBookmarkId(user.getId(), fish.getId());
        this.user = user;
        this.fish = fish;
    }

    @PrePersist
    void prePersist() {
        if (createdAt == null) {
            createdAt = OffsetDateTime.now();
        }
    }
}
