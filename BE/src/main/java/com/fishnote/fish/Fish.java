package com.fishnote.fish;

import com.fishnote.review.Review;
import jakarta.persistence.CascadeType;
import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.JoinTable;
import jakarta.persistence.ManyToMany;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;
import jakarta.persistence.OrderColumn;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.AbstractList;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.BatchSize;
import org.hibernate.annotations.ColumnDefault;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

@Entity
@Table(
        name = "fish",
        indexes = @Index(name = "idx_fish_name", columnList = "name"),
        uniqueConstraints = {
            @UniqueConstraint(name = "uq_fish_name", columnNames = "name"),
            @UniqueConstraint(name = "uq_fish_slug", columnNames = "slug")
        })
@Getter
@Setter
@NoArgsConstructor
public class Fish {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 100)
    private String name;

    @Column(name = "name_en", length = 100)
    private String nameEn;

    @Column(length = 120)
    private String slug;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private FishCategory category = FishCategory.FISH;

    @Column(name = "scientific_name", length = 150)
    private String scientificName;

    @Column(name = "image_url", columnDefinition = "text")
    private String imageUrl;

    @Column(name = "taste_desc", columnDefinition = "text")
    private String tasteDesc;

    @Column(name = "price_level")
    private Short priceLevel;

    @Column(nullable = false, columnDefinition = "boolean default false")
    private boolean featured = false;

    @OneToMany(mappedBy = "fish", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("imageOrder ASC")
    @BatchSize(size = 100)
    @Setter(AccessLevel.NONE)
    private List<FishImage> imageMedia = new ArrayList<>();

    @Column(columnDefinition = "text")
    private String description;

    @CreationTimestamp
    @ColumnDefault("now()")
    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private OffsetDateTime updatedAt;

    @ElementCollection(fetch = FetchType.LAZY)
    @CollectionTable(name = "fish_season_month", joinColumns = @JoinColumn(name = "fish_id"))
    @Column(name = "month", nullable = false)
    private Set<Short> seasonMonths = new LinkedHashSet<>();

    @ElementCollection(fetch = FetchType.LAZY)
    @CollectionTable(name = "fish_taste_tag", joinColumns = @JoinColumn(name = "fish_id"))
    @Column(name = "tag", nullable = false, length = 30)
    private Set<String> tasteTags = new LinkedHashSet<>();

    @ElementCollection(fetch = FetchType.LAZY)
    @CollectionTable(name = "fish_tip", joinColumns = @JoinColumn(name = "fish_id"))
    @OrderColumn(name = "tip_order", nullable = false, columnDefinition = "integer")
    @Column(name = "content", nullable = false, columnDefinition = "text")
    private List<String> tips = new ArrayList<>();

    @ManyToMany(fetch = FetchType.LAZY)
    @JoinTable(
            name = "fish_similar",
            joinColumns = @JoinColumn(name = "fish_id"),
            inverseJoinColumns = @JoinColumn(name = "similar_fish_id"))
    private Set<Fish> similarFishes = new LinkedHashSet<>();

    @OneToMany(mappedBy = "fish", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<Review> reviews = new ArrayList<>();

    @OneToMany(mappedBy = "fish", cascade = CascadeType.ALL, orphanRemoval = true)
    @Setter(AccessLevel.NONE)
    private Set<FishAlias> aliases = new LinkedHashSet<>();

    public FishAlias addAlias(String alias, FishAliasType aliasType) {
        FishAlias fishAlias = new FishAlias(this, alias, aliasType);
        aliases.add(fishAlias);
        return fishAlias;
    }

    public void removeAlias(FishAlias fishAlias) {
        if (aliases.remove(fishAlias)) {
            fishAlias.detach();
        }
    }

    /**
     * Mutable legacy URL view retained for fixtures and the v1 {@code images: string[]} contract.
     * Metadata-aware callers should use {@link #getImageMedia()} and {@link #addMedia}.
     */
    public List<String> getImages() {
        return new AbstractList<>() {
            @Override
            public String get(int index) {
                return imageMedia.get(index).getUrl();
            }

            @Override
            public int size() {
                return imageMedia.size();
            }

            @Override
            public void add(int index, String url) {
                if (index != imageMedia.size()) {
                    throw new UnsupportedOperationException("legacy 이미지는 목록 끝에만 추가할 수 있습니다.");
                }
                imageMedia.add(FishImage.legacy(Fish.this, nextImageOrder(), url));
                modCount++;
            }

            @Override
            public String set(int index, String url) {
                FishImage image = imageMedia.get(index);
                String previous = image.getUrl();
                image.replaceLegacyUrl(url);
                return previous;
            }

            @Override
            public String remove(int index) {
                FishImage removed = imageMedia.remove(index);
                removed.detach();
                reindexLegacyImages();
                modCount++;
                return removed.getUrl();
            }
        };
    }

    public FishImage addMedia(
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
        if (role == FishImageRole.PRIMARY
                && imageMedia.stream().anyMatch(image -> image.getRole() == FishImageRole.PRIMARY)) {
            throw new IllegalStateException("대표 이미지는 어종별로 하나만 등록할 수 있습니다.");
        }
        int imageOrder = nextImageOrder();
        FishImage image = new FishImage(
                this,
                imageOrder,
                role,
                url,
                publicId,
                width,
                height,
                alt,
                credit,
                sourceUrl,
                license,
                focalX,
                focalY,
                blurDataUrl);
        imageMedia.add(image);
        return image;
    }

    private int nextImageOrder() {
        return imageMedia.stream()
                .mapToInt(FishImage::getImageOrder)
                .max()
                .orElse(-1) + 1;
    }

    private void reindexLegacyImages() {
        for (int index = 0; index < imageMedia.size(); index++) {
            imageMedia.get(index).reindexLegacy(
                    index,
                    index == 0 ? FishImageRole.PRIMARY : FishImageRole.GALLERY);
        }
    }
}
