package com.fishnote.price;

import java.util.Set;

/** Published inside the import transaction and delivered to hooks only after commit. */
public record PriceImportCommittedEvent(
        Set<Long> fishIds,
        TelegramPriceImportResponse response) {

    public PriceImportCommittedEvent {
        fishIds = fishIds == null ? Set.of() : Set.copyOf(fishIds);
    }
}
