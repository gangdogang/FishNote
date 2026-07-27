package com.fishnote.fish.dto;

/**
 * Interface projection for the native, window-ranked suggestion query.
 *
 * <p>The quoted column aliases in {@code FishAliasRepository} intentionally match these
 * accessor names so Spring Data can map the PostgreSQL and H2 result sets without loading
 * {@code FishAlias} entities.</p>
 */
public interface FishSuggestionCandidate {

    Long getId();

    String getSlug();

    String getName();

    String getMatchedAlias();

    String getThumbnail();
}
