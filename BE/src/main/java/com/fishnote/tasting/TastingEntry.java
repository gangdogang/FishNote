package com.fishnote.tasting;

import com.fishnote.fish.Fish;
import com.fishnote.user.User;
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
import java.time.LocalDate;
import java.time.OffsetDateTime;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

@Entity
@Table(
        name = "tasting_entry",
        indexes = {
            @Index(name = "idx_tasting_entry_user_date", columnList = "user_id, tasted_on, id"),
            @Index(name = "idx_tasting_entry_fish", columnList = "fish_id")
        })
@Getter
@Setter
@NoArgsConstructor
public class TastingEntry {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "fish_id", nullable = false)
    private Fish fish;

    @Column(name = "tasted_on", nullable = false)
    private LocalDate tastedOn;

    @Column
    private Short rating;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private TastingPreparation preparation;

    @Column(name = "place_name", length = 100)
    private String placeName;

    @Column(length = 500)
    private String note;

    @Column(name = "image_url", columnDefinition = "text")
    private String imageUrl;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private OffsetDateTime updatedAt;
}
