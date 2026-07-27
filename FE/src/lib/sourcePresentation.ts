import type { FishClaimType, SourceConfidence, VerificationStatus } from '../types/source';

export const CLAIM_ORDER: FishClaimType[] = ['IDENTITY', 'SEASON', 'TASTE', 'PRICE', 'PHOTO'];

export function claimTypeLabel(claimType: FishClaimType) {
  const labels: Record<FishClaimType, string> = {
    IDENTITY: '이름·분류',
    SEASON: '제철',
    TASTE: '맛',
    PRICE: '가격',
    PHOTO: '사진',
  };
  return labels[claimType];
}

export function verificationStatusLabel(status: VerificationStatus) {
  const labels: Record<VerificationStatus, string> = {
    VERIFIED: '검증 완료',
    PARTIALLY_VERIFIED: '일부 검증',
    UNVERIFIED: '검증 전',
  };
  return labels[status];
}

export function confidenceLabel(confidence: SourceConfidence) {
  const labels: Record<SourceConfidence, string> = {
    HIGH: '신뢰도 높음',
    MEDIUM: '신뢰도 보통',
    LOW: '참고 자료',
  };
  return labels[confidence];
}

export function formatSourceDate(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'Asia/Seoul',
  }).format(date);
}
