import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { FishCorrectionRequest, FishSourcesResponse } from '../types/source';
import { useFishSources, useSubmitFishCorrection } from './useFishSources';

const sourceApiMocks = vi.hoisted(() => ({
  getFishSources: vi.fn(),
  submitFishCorrection: vi.fn(),
}));

vi.mock('../api/source', () => sourceApiMocks);

const sourcesResponse: FishSourcesResponse = {
  fishId: 16,
  fishName: '가숭어',
  summary: {
    verificationStatus: 'PARTIALLY_VERIFIED',
    lastVerifiedAt: '2026-07-23T01:30:00Z',
    sourceCount: 1,
  },
  claims: [
    {
      claimType: 'SEASON',
      verificationStatus: 'PARTIALLY_VERIFIED',
      lastVerifiedAt: '2026-07-23T01:30:00Z',
      sourceCount: 1,
      sources: [
        {
          id: 101,
          claimType: 'SEASON',
          publisher: '해양수산부',
          title: '이달의 수산물',
          url: 'https://example.com/source',
          publishedAt: '2025-12-01',
          verifiedAt: '2026-07-23T01:30:00Z',
          license: null,
          confidence: 'MEDIUM',
        },
      ],
    },
  ],
};

function createHarness() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        gcTime: Infinity,
        retryDelay: 0,
      },
      mutations: {
        retry: false,
      },
    },
  });

  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }

  return { queryClient, Wrapper };
}

function axiosLikeError(status?: number) {
  return {
    isAxiosError: true,
    response: status === undefined ? undefined : { status },
  };
}

beforeEach(() => {
  sourceApiMocks.getFishSources.mockReset();
  sourceApiMocks.submitFishCorrection.mockReset();
});

describe('useFishSources', () => {
  it.each([
    0,
    -1,
    1.5,
    Number.NaN,
    Number.POSITIVE_INFINITY,
    Number.MAX_SAFE_INTEGER + 1,
    '',
    '참돔',
    'not a slug',
    'A'.repeat(121),
  ])('does not request an invalid identifier (%s)', (identifier) => {
    const { Wrapper } = createHarness();
    const { result } = renderHook(() => useFishSources(identifier), { wrapper: Wrapper });

    expect(result.current.fetchStatus).toBe('idle');
    expect(sourceApiMocks.getFishSources).not.toHaveBeenCalled();
  });

  it('uses the normalized identifier in the exact sources query key', async () => {
    sourceApiMocks.getFishSources.mockResolvedValue(sourcesResponse);
    const { queryClient, Wrapper } = createHarness();
    const { result } = renderHook(() => useFishSources(16), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(sourceApiMocks.getFishSources).toHaveBeenCalledWith('16');
    expect(queryClient.getQueryData(['fish', 'sources', '16'])).toEqual(sourcesResponse);
  });

  it('requests a valid canonical slug', async () => {
    sourceApiMocks.getFishSources.mockResolvedValue(sourcesResponse);
    const { Wrapper } = createHarness();
    const { result } = renderHook(() => useFishSources('ga-sungeo'), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(sourceApiMocks.getFishSources).toHaveBeenCalledWith('ga-sungeo');
  });

  it('does not retry a 404 response', async () => {
    sourceApiMocks.getFishSources.mockRejectedValue(axiosLikeError(404));
    const { Wrapper } = createHarness();
    const { result } = renderHook(() => useFishSources('ga-sungeo'), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(sourceApiMocks.getFishSources).toHaveBeenCalledTimes(1);
  });

  it('retries a 5xx response only once', async () => {
    sourceApiMocks.getFishSources.mockRejectedValue(axiosLikeError(503));
    const { Wrapper } = createHarness();
    const { result } = renderHook(() => useFishSources('ga-sungeo'), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(sourceApiMocks.getFishSources).toHaveBeenCalledTimes(2);
  });
});

describe('useSubmitFishCorrection', () => {
  it('submits the complete payload and leaves existing caches fresh', async () => {
    const request: FishCorrectionRequest = {
      claimType: 'SEASON',
      message: '겨울 제철 근거를 확인해 주세요.',
      sourceUrl: 'https://example.com/evidence',
    };
    const receipt = { id: 901, status: 'PENDING' as const };
    sourceApiMocks.submitFishCorrection.mockResolvedValue(receipt);
    const { queryClient, Wrapper } = createHarness();
    queryClient.setQueryData(['fish', 'sources', '16'], sourcesResponse);
    const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries');
    const { result } = renderHook(() => useSubmitFishCorrection(16), { wrapper: Wrapper });

    await act(async () => {
      await expect(result.current.mutateAsync(request)).resolves.toEqual(receipt);
    });

    expect(sourceApiMocks.submitFishCorrection).toHaveBeenCalledWith(16, request);
    expect(invalidateQueries).not.toHaveBeenCalled();
    expect(queryClient.getQueryState(['fish', 'sources', '16'])?.isInvalidated).toBe(false);
  });

  it('preserves an omitted optional source URL in the POST request shape', async () => {
    const request: FishCorrectionRequest = {
      claimType: 'PHOTO',
      message: '사진이 다른 어종으로 보여요.',
    };
    sourceApiMocks.submitFishCorrection.mockResolvedValue({ id: 902, status: 'PENDING' });
    const { Wrapper } = createHarness();
    const { result } = renderHook(() => useSubmitFishCorrection(16), { wrapper: Wrapper });

    await act(async () => {
      await result.current.mutateAsync(request);
    });

    expect(sourceApiMocks.submitFishCorrection).toHaveBeenCalledWith(16, request);
  });
});
