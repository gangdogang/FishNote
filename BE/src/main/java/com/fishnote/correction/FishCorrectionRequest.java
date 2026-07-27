package com.fishnote.correction;

import com.fishnote.fish.Fish;
import com.fishnote.source.FishClaimType;
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
import java.time.OffsetDateTime;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.ColumnDefault;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.OnDelete;
import org.hibernate.annotations.OnDeleteAction;

@Entity
@Table(
        name = "fish_correction_request",
        indexes = {
            @Index(
                    name = "idx_fish_correction_request_fish_created",
                    columnList = "fish_id, created_at, id"),
            @Index(
                    name = "idx_fish_correction_request_status_created",
                    columnList = "status, created_at, id")
        })
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class FishCorrectionRequest {

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

    @Column(nullable = false, length = 1000)
    private String message;

    @Column(name = "source_url", columnDefinition = "text")
    private String sourceUrl;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    @ColumnDefault("'PENDING'")
    private CorrectionRequestStatus status = CorrectionRequestStatus.PENDING;

    @CreationTimestamp
    @ColumnDefault("now()")
    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    @Column(name = "resolved_at")
    private OffsetDateTime resolvedAt;

    FishCorrectionRequest(
            Fish fish,
            FishClaimType claimType,
            String message,
            String sourceUrl) {
        this.fish = fish;
        this.claimType = claimType;
        this.message = message;
        this.sourceUrl = sourceUrl;
    }
}
