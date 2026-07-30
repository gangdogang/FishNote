import type { FishCatalogPage, FishSummary } from '../types/fish';

export function mergeFishCatalogPages(pages: readonly FishCatalogPage[]): FishSummary[] {
  const seen = new Set<number>();
  return pages.flatMap((page) => page.items).filter((fish) => {
    if (seen.has(fish.id)) return false;
    seen.add(fish.id);
    return true;
  });
}
