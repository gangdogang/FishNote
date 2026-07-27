import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { FishCorrectionRequest, FishSourcesResponse } from '../types/source';
import { getFishSources, submitFishCorrection } from './source';

const clientMocks = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
}));

vi.mock('./client', () => ({
  apiClient: clientMocks,
}));

const sourcesResponse: FishSourcesResponse = {
  fishId: 20,
  fishName: '가자미',
  summary: {
    verificationStatus: 'VERIFIED',
    lastVerifiedAt: '2026-07-23T01:30:00Z',
    sourceCount: 1,
  },
  claims: [
    {
      claimType: 'SEASON',
      verificationStatus: 'VERIFIED',
      lastVerifiedAt: '2026-07-23T01:30:00Z',
      sourceCount: 1,
      sources: [
        {
          id: 101,
          claimType: 'SEASON',
          publisher: '해양수산부',
          title: '이달의 수산물',
          url: 'https://example.com/source',
          publishedAt: '2026-03-01',
          verifiedAt: '2026-07-23T01:30:00Z',
          license: 'KOGL',
          confidence: 'HIGH',
        },
      ],
    },
  ],
};

beforeEach(() => {
  clientMocks.get.mockReset();
  clientMocks.post.mockReset();
});

describe('source API', () => {
  it('encodes a fish identifier before requesting its sources', async () => {
    clientMocks.get.mockResolvedValue({ data: sourcesResponse });

    await expect(getFishSources('flat fish/광어')).resolves.toEqual(sourcesResponse);

    expect(clientMocks.get).toHaveBeenCalledWith(
      '/fish/flat%20fish%2F%EA%B4%91%EC%96%B4/sources',
    );
  });

  it('posts the correction payload unchanged and returns its receipt', async () => {
    const request: FishCorrectionRequest = {
      claimType: 'SEASON',
      message: '제철 월을 다시 확인해 주세요.',
      sourceUrl: 'https://example.com/evidence',
    };
    const receipt = { id: 301, status: 'PENDING' as const };
    clientMocks.post.mockResolvedValue({ data: receipt });

    await expect(submitFishCorrection(20, request)).resolves.toEqual(receipt);

    expect(clientMocks.post).toHaveBeenCalledWith('/fish/20/corrections', request);
  });
});
