interface FishRouteTarget {
  id: number;
  slug?: string | null;
}

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MAX_SLUG_LENGTH = 120;
const MAX_LONG_ID = 9_223_372_036_854_775_807n;

export function fishDetailPath(fish: FishRouteTarget) {
  const slug = fish.slug?.trim();
  const identifier = slug && isValidFishSlug(slug) ? slug : String(fish.id);
  return `/fish/${encodeURIComponent(identifier)}`;
}

export function isValidFishIdentifier(identifier: string | undefined) {
  if (!identifier) return false;

  if (/^\d+$/.test(identifier)) {
    try {
      const id = BigInt(identifier);
      return id > 0n && id <= MAX_LONG_ID;
    } catch {
      return false;
    }
  }

  return isValidFishSlug(identifier);
}

function isValidFishSlug(slug: string) {
  return slug.length <= MAX_SLUG_LENGTH && SLUG_PATTERN.test(slug);
}
