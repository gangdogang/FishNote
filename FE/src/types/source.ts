export type FishClaimType = 'IDENTITY' | 'SEASON' | 'TASTE' | 'PRICE' | 'PHOTO';

export type VerificationStatus = 'VERIFIED' | 'PARTIALLY_VERIFIED' | 'UNVERIFIED';

export type SourceConfidence = 'HIGH' | 'MEDIUM' | 'LOW';

export interface FishSource {
  id: number;
  claimType: FishClaimType;
  publisher: string;
  title: string;
  url: string;
  publishedAt: string | null;
  verifiedAt: string | null;
  license: string | null;
  confidence: SourceConfidence;
}

export interface FishClaimSources {
  claimType: FishClaimType;
  verificationStatus: VerificationStatus;
  lastVerifiedAt: string | null;
  sourceCount: number;
  sources: FishSource[];
}

export type FishSourceClaim = FishClaimSources;

export interface FishSourceSummary {
  verificationStatus: VerificationStatus;
  lastVerifiedAt: string | null;
  sourceCount: number;
  verifiedClaimCount?: number;
  claimCount?: number;
}

export interface FishSourcesResponse {
  fishId: number;
  fishName: string;
  summary: FishSourceSummary;
  claims: FishClaimSources[];
}

export interface FishCorrectionRequest {
  claimType: FishClaimType;
  message: string;
  sourceUrl?: string | null;
}

export type FishCorrectionStatus = 'PENDING' | 'RESOLVED' | 'REJECTED';

export interface FishCorrectionReceipt {
  id: number;
  status: FishCorrectionStatus;
}
