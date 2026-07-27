export interface Review {
  id: number;
  fishId: number;
  nickname: string;
  rating: number | null;
  content: string;
  imageUrl: string | null;
  helpfulCount: number;
  createdAt: string;
  mine: boolean;
}

export interface ReviewList {
  fishId: number;
  avgRating: number;
  totalCount: number;
  ratingCount?: number;
  ratingDistribution: Record<'1' | '2' | '3' | '4' | '5', number>;
  reviews: Review[];
  page: number;
  size: number;
  hasNext: boolean;
  /** Opaque v2 cursor; absent when the v1 page fallback served the response. */
  nextCursor?: string | null;
}

export type ReviewSort = 'latest' | 'helpful';

export interface ReviewRequest {
  nickname?: string;
  rating?: number | null;
  content: string;
  imageUrl?: string | null;
  imageAssetId?: string | null;
  password?: string;
}

export interface ReviewHelpfulResponse {
  id: number;
  helpfulCount: number;
}
