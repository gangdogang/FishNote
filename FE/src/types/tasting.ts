export type TastingPreparation = 'RAW' | 'AGED' | 'SEKKOSI' | 'OTHER';

export interface TastingEntryRequest {
  fishId: number;
  tastedOn: string;
  rating: number | null;
  preparation: TastingPreparation;
  placeName: string | null;
  note: string | null;
  imageUrl?: string | null;
  imageAssetId?: string | null;
}

export interface TastingEntry {
  id: number;
  fishId: number;
  fishSlug: string | null;
  fishName: string;
  fishImageUrl: string | null;
  tastedOn: string;
  rating: number | null;
  preparation: TastingPreparation;
  placeName: string | null;
  note: string | null;
  imageUrl: string | null;
  createdAt: string;
  updatedAt: string | null;
}

export interface TastingStats {
  totalEntries: number;
  distinctFishCount: number;
  currentMonthEntries: number;
}

export interface TastingEntryPage {
  items: TastingEntry[];
  page: number;
  size: number;
  totalCount: number;
  hasNext: boolean;
  stats: TastingStats;
}
