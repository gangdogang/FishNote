package com.fishnote.price;

import com.fishnote.fish.Fish;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.ColumnDefault;
import org.hibernate.annotations.Check;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.OnDelete;
import org.hibernate.annotations.OnDeleteAction;

@Entity
@Check(constraints = "price_min_krw > 0 AND price_max_krw > 0 AND price_min_krw <= price_max_krw AND confidence BETWEEN 0 AND 1")
@Table(
        name = "shop_price_observation",
        indexes = {
            @Index(name = "idx_shop_price_fish_observed", columnList = "fish_id, observed_at"),
            @Index(name = "idx_shop_price_name_observed", columnList = "canonical_fish_name, observed_at")
        })
@Getter
@Setter
@NoArgsConstructor
public class ShopPriceObservation {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "fish_id")
    @OnDelete(action = OnDeleteAction.SET_NULL)
    private Fish fish;

    @Column(name = "observed_at", nullable = false)
    private OffsetDateTime observedAt;

    @Column(name = "source_type", nullable = false, length = 50)
    private String sourceType;

    @Column(name = "source_name", length = 100)
    private String sourceName;

    @Column(length = 100)
    private String speaker;

    @Column(name = "canonical_fish_name", length = 100)
    private String canonicalFishName;

    @Column(name = "reported_name", nullable = false, length = 100)
    private String reportedName;

    @Column(length = 50)
    private String condition;

    @Column(length = 100)
    private String origin;

    @Column(name = "size_grade", length = 100)
    private String sizeGrade;

    @Column(length = 30)
    private String unit;

    @Column(name = "price_min_krw", nullable = false)
    private int priceMinKrw;

    @Column(name = "price_max_krw", nullable = false)
    private int priceMaxKrw;

    @Column(nullable = false, precision = 3, scale = 2)
    @ColumnDefault("0.5")
    private BigDecimal confidence = BigDecimal.valueOf(0.5);

    @Column(name = "raw_text", nullable = false, columnDefinition = "text")
    private String rawText;

    @Column(name = "dedup_hash", nullable = false, unique = true, length = 64)
    private String dedupHash;

    @CreationTimestamp
    @ColumnDefault("now()")
    @Column(name = "collected_at", nullable = false, updatable = false)
    private OffsetDateTime collectedAt;

    @PrePersist
    @PreUpdate
    void refreshDedupHash() {
        dedupHash = DedupKeyFactory.create(this);
    }
}
