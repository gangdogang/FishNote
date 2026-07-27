package com.fishnote.fish;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.AccessLevel;

@Entity
@Table(
        name = "fish_alias",
        uniqueConstraints = @UniqueConstraint(
                name = "uq_fish_alias",
                columnNames = {"fish_id", "alias"}))
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class FishAlias {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "fish_id", nullable = false)
    private Fish fish;

    @Column(nullable = false, length = 100)
    private String alias;

    @Enumerated(EnumType.STRING)
    @Column(name = "alias_type", nullable = false, length = 30)
    private FishAliasType aliasType;

    FishAlias(Fish fish, String alias, FishAliasType aliasType) {
        this.fish = fish;
        this.alias = alias;
        this.aliasType = aliasType;
    }

    void detach() {
        this.fish = null;
    }
}
