export type Season = 'spring' | 'summer' | 'fall' | 'winter';
export type FishSort = 'popular' | 'name';
export type FishCategory = 'FISH' | 'SHELLFISH' | 'CEPHALOPOD';

export interface FishMedia {
  id: string;
  url: string;
  width: number;
  height: number;
  alt: string;
  role: 'PRIMARY' | 'GALLERY';
  credit?: string;
  sourceUrl?: string;
  license?: string;
  blurDataUrl?: string | null;
  focalPoint?: {
    x: number;
    y: number;
  };
}

export interface FishListParams {
  search?: string;
  season?: Season;
  taste?: string;
  priceLevel?: number;
  month?: number;
  featured?: boolean;
  sort?: FishSort;
}

export interface FishFacets {
  taste: Record<string, number>;
  season: Record<string, number>;
  priceLevel: Record<string, number>;
  category: Record<string, number>;
}

export interface FishCatalogPageInfo {
  nextCursor: string | null;
  hasNext: boolean;
  limit: number;
}

export interface FishCatalogPage {
  items: FishSummary[];
  pageInfo: FishCatalogPageInfo;
  facets: FishFacets;
}

export interface HomeData {
  month: number;
  generatedAt: string;
  seasonal: FishSummary[];
  featured: FishSummary[];
  catalog: FishSummary[];
  facets: FishFacets;
}

export interface FishSummary {
  id: number;
  slug?: string | null;
  category?: FishCategory;
  name: string;
  media?: FishMedia | null;
  imageUrl: string | null;
  description: string | null;
  priceLevel: number | null;
  tasteTags: string[];
  seasonMonths: number[];
  featured: boolean;
  avgRating: number;
  reviewCount: number;
  /** Additive API field; omitted by legacy fixtures/endpoints. */
  ratingCount?: number;
}

export interface SimilarFish {
  id: number;
  slug?: string | null;
  name: string;
  media?: FishMedia | null;
  imageUrl: string | null;
  priceLevel: number | null;
  avgRating: number;
  ratingCount?: number;
  seasonMonths: number[];
}

export type RatingDistribution = Record<'1' | '2' | '3' | '4' | '5', number>;

export interface FishDetail extends FishSummary {
  nameEn: string | null;
  scientificName?: string | null;
  aliases?: string[];
  /** Legacy detail field retained for wire compatibility; D2 verification uses the source summary. */
  verificationStatus?: string | null;
  galleryMedia?: FishMedia[];
  images: string[];
  tasteDesc: string | null;
  ratingDistribution: RatingDistribution;
  tips: string[];
  similarFishes: SimilarFish[];
}

export interface FishSuggestion {
  id: number;
  slug: string | null;
  name: string;
  matchedAlias: string | null;
  thumbnail: string | null;
}

export interface FishSuggestionsResponse {
  items: FishSuggestion[];
}

export interface FishPriceObservation {
  observedAt: string;
  priceMinKrw: number;
  priceMaxKrw: number;
  unit: string | null;
  origin: string | null;
  sizeGrade: string | null;
  sourceLabel: string;
  shopName: string | null;
}

export interface FishPriceTrendPoint {
  observedDate: string;
  priceMinKrw: number;
  priceMaxKrw: number;
  avgPriceKrw: number;
  observationCount: number;
}

export interface FishShopPriceSeries {
  shopName: string;
  observationCount: number;
  latest: FishPriceObservation;
  graph: FishPriceTrendPoint[];
}

export interface FishVariantPriceSeries {
  variantKey: string;
  variantLabel: string;
  farming: string;
  origin: string;
  unit: string;
  observationCount: number;
  latest: FishPriceObservation;
  graph: FishPriceTrendPoint[];
}

export type FishPriceResolution = 'DAY' | 'WEEK' | 'MONTH';
export type FishPriceNoDataReason = 'NO_OBSERVATIONS_IN_RANGE' | 'VARIANT_NOT_FOUND';

export interface FishPriceSummary {
  fishId: number;
  days: number;
  /** Additive price-read contract; optional while older API fixtures remain supported. */
  resolution?: FishPriceResolution;
  maxPoints?: number;
  variantKey?: string | null;
  asOf?: string | null;
  currency?: 'KRW';
  normalizedUnit?: string | null;
  sourceCount?: number;
  noDataReason?: FishPriceNoDataReason | null;
  observationCount: number;
  latest: FishPriceObservation | null;
  recent: FishPriceObservation[];
  dailyAverage: FishPriceTrendPoint[];
  byShop: FishShopPriceSeries[];
  byVariant: FishVariantPriceSeries[];
}
