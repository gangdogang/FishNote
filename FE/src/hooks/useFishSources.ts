import { useMutation, useQuery } from '@tanstack/react-query';
import { getFishSources, submitFishCorrection } from '../api/source';
import { isValidResourceId, retryTransientQueryOnce } from '../lib/errors';
import { isValidFishIdentifier } from '../lib/fishRoutes';
import type { FishCorrectionRequest } from '../types/source';

export function useFishSources(identifier: string | number) {
  const normalizedIdentifier = String(identifier);

  return useQuery({
    queryKey: ['fish', 'sources', normalizedIdentifier],
    queryFn: () => getFishSources(normalizedIdentifier),
    enabled: typeof identifier === 'number'
      ? isValidResourceId(identifier)
      : isValidFishIdentifier(normalizedIdentifier),
    retry: retryTransientQueryOnce,
  });
}

export function useSubmitFishCorrection(fishId: number) {
  return useMutation({
    mutationFn: (request: FishCorrectionRequest) => submitFishCorrection(fishId, request),
  });
}
