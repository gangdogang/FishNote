package com.fishnote.fish;

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
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.OnDelete;
import org.hibernate.annotations.OnDeleteAction;
import org.hibernate.annotations.UpdateTimestamp;
import org.springframework.util.StringUtils;

@Entity
@Table(
        name = "fish_image",
        indexes = @Index(
                name = "idx_fish_image_fish_role_order",
                columnList = "fish_id, role, image_order"),
        uniqueConstraints = {
            @UniqueConstraint(
                    name = "uq_fish_image_order",
                    columnNames = {"fish_id", "image_order"}),
            @UniqueConstraint(
                    name = "uq_fish_image_public_id",
                    columnNames = "public_id")
        })
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class FishImage {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "fish_id", nullable = false)
    @OnDelete(action = OnDeleteAction.CASCADE)
    private Fish fish;

    @Column(name = "image_order", nullable = false)
    private int imageOrder;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private FishImageRole role;

    @Column(nullable = false, columnDefinition = "text")
    private String url;

    @Column(name = "public_id", length = 255)
    private String publicId;

    @Column
    private Integer width;

    @Column
    private Integer height;

    @Column(nullable = false, length = 300)
    private String alt;

    @Column(length = 300)
    private String credit;

    @Column(name = "source_url", columnDefinition = "text")
    private String sourceUrl;

    @Column(length = 150)
    private String license;

    @Column(name = "focal_x", precision = 5, scale = 4)
    private BigDecimal focalX;

    @Column(name = "focal_y", precision = 5, scale = 4)
    private BigDecimal focalY;

    @Column(name = "blur_data_url", columnDefinition = "text")
    private String blurDataUrl;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;

    public FishImage(
            Fish fish,
            int imageOrder,
            FishImageRole role,
            String url,
            String publicId,
            Integer width,
            Integer height,
            String alt,
            String credit,
            String sourceUrl,
            String license,
            BigDecimal focalX,
            BigDecimal focalY,
            String blurDataUrl) {
        this.fish = fish;
        this.imageOrder = imageOrder;
        this.role = role;
        this.url = url;
        this.publicId = publicId;
        this.width = width;
        this.height = height;
        this.alt = alt;
        this.credit = credit;
        this.sourceUrl = sourceUrl;
        this.license = license;
        this.focalX = focalX;
        this.focalY = focalY;
        this.blurDataUrl = blurDataUrl;
    }

    static FishImage legacy(Fish fish, int imageOrder, String url) {
        FishImageRole role = imageOrder == 0 ? FishImageRole.PRIMARY : FishImageRole.GALLERY;
        return new FishImage(
                fish,
                imageOrder,
                role,
                url,
                null,
                null,
                null,
                fish.getName() + " 사진",
                null,
                null,
                null,
                null,
                null,
                null);
    }

    public boolean hasResponsiveMetadata() {
        return StringUtils.hasText(url)
                && width != null
                && width > 0
                && height != null
                && height > 0
                && StringUtils.hasText(alt);
    }

    void replaceLegacyUrl(String url) {
        this.url = url;
    }

    void reindexLegacy(int imageOrder, FishImageRole role) {
        this.imageOrder = imageOrder;
        this.role = role;
    }

    void detach() {
        this.fish = null;
    }
}
