package com.fishnote.source;

import com.fishnote.fish.Fish;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.OnDelete;
import org.hibernate.annotations.OnDeleteAction;

@Entity
@Table(
        name = "fish_source",
        indexes = @Index(
                name = "idx_fish_source_fish_claim_verified",
                columnList = "fish_id, claim_type, verified_at, id"),
        uniqueConstraints = @UniqueConstraint(
                name = "uq_fish_source_claim_url",
                columnNames = {"fish_id", "claim_type", "url"}))
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class FishSource {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "fish_id", nullable = false)
    @OnDelete(action = OnDeleteAction.CASCADE)
    private Fish fish;

    @Enumerated(EnumType.STRING)
    @Column(name = "claim_type", nullable = false, length = 30)
    private FishClaimType claimType;

    @Column(nullable = false, length = 150)
    private String publisher;

    @Column(nullable = false, length = 300)
    private String title;

    @Column(nullable = false, columnDefinition = "text")
    private String url;

    @Column(name = "published_at")
    private LocalDate publishedAt;

    @Column(name = "verified_at")
    private OffsetDateTime verifiedAt;

    @Column(length = 100)
    private String license;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private SourceConfidence confidence;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    public FishSource(
            Fish fish,
            FishClaimType claimType,
            String publisher,
            String title,
            String url,
            LocalDate publishedAt,
            OffsetDateTime verifiedAt,
            String license,
            SourceConfidence confidence) {
        this.fish = fish;
        this.claimType = claimType;
        this.publisher = publisher;
        this.title = title;
        this.url = url;
        this.publishedAt = publishedAt;
        this.verifiedAt = verifiedAt;
        this.license = license;
        this.confidence = confidence;
    }
}
