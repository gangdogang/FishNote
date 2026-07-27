package com.fishnote.price;

/**
 * Extension point for post-import work such as price-cache invalidation.
 *
 * <p>Hooks run after the database commit and must be best-effort; throwing from one hook does not
 * affect the committed import or prevent later hooks from running.
 */
@FunctionalInterface
public interface PriceImportAfterCommitHook {

    void afterCommit(PriceImportCommittedEvent event);
}
