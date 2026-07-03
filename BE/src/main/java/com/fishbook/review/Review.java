package com.fishbook.review;

import com.fishbook.fish.Fish;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.time.OffsetDateTime;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.ColumnDefault;
import org.hibernate.annotations.CreationTimestamp;

@Entity
@Table(name = "review", indexes = @Index(name = "idx_review_fish", columnList = "fish_id"))
@Getter
@Setter
@NoArgsConstructor
public class Review {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "fish_id", nullable = false)
    private Fish fish;

    @Column(nullable = false, length = 30)
    private String nickname;

    @Column
    private Short rating;

    @Column(nullable = false, columnDefinition = "text")
    private String content;

    @Column(name = "image_url", columnDefinition = "text")
    private String imageUrl;

    @Column(name = "password_hash", nullable = false, length = 100)
    private String passwordHash;

    @Column(name = "helpful_count", nullable = false, columnDefinition = "integer default 0")
    private int helpfulCount = 0;

    @CreationTimestamp
    @ColumnDefault("now()")
    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;
}
