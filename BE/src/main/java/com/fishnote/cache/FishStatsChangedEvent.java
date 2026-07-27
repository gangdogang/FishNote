package com.fishnote.cache;

public record FishStatsChangedEvent(Long fishId, String fishSlug) {
}
