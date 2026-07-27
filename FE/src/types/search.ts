import type { Season } from './fish';

export interface SearchFilterValues {
  season?: Season;
  month?: number;
  taste?: string;
  priceLevel?: number;
}
