package com.fishbook.fish;

import com.fishbook.review.Review;
import jakarta.persistence.CascadeType;
import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.JoinTable;
import jakarta.persistence.ManyToMany;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderColumn;
import jakarta.persistence.Table;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.ColumnDefault;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

@Entity
@Table(name = "fish", indexes = @Index(name = "idx_fish_name", columnList = "name"))
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

    @Column(name = "image_url", columnDefinition = "text")
    private String imageUrl;

    @Column(name = "taste_desc", columnDefinition = "text")
    private String tasteDesc;

    @Column(name = "price_level")
    private Short priceLevel;

    @Column(nullable = false, columnDefinition = "boolean default false")
    private boolean featured = false;

    @ElementCollection(fetch = FetchType.LAZY)
    @CollectionTable(name = "fish_image", joinColumns = @JoinColumn(name = "fish_id"))
    @OrderColumn(name = "image_order", nullable = false, columnDefinition = "smallint")
    @Column(name = "url", nullable = false, columnDefinition = "text")
    private List<String> images = new ArrayList<>();

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
    @OrderColumn(name = "tip_order", nullable = false)
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
}
