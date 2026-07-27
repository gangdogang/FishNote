import { useQuery } from '@tanstack/react-query';
import { getFishDetail, getFishList, getFishPrices, getHomeData } from '../api/fish';
import { isValidResourceId, retryTransientQueryOnce } from '../lib/errors';
import { isValidFishIdentifier } from '../lib/fishRoutes';
import type { FishListParams } from '../types/fish';

interface FishListQueryOptions {
  enabled?: boolean;
}

export function useFishList(params: FishListParams = {}, options: FishListQueryOptions = {}) {
  return useQuery({
    queryKey: ['fish', params],
    queryFn: () => getFishList(params),
    enabled: options.enabled ?? true,
  });
}

export function useHomeData(month: number, sort: 'popular' | 'name' = 'popular') {
  return useQuery({
    queryKey: ['home', { month, sort }],
    queryFn: () => getHomeData(month, sort),
    staleTime: 60_000,
  });
}

export function useFishDetail(identifier: string | number) {
  const normalizedIdentifier = String(identifier);
  return useQuery({
    queryKey: ['fish', 'detail', normalizedIdentifier],
    queryFn: () => getFishDetail(normalizedIdentifier),
    enabled: typeof identifier === 'number'
      ? isValidResourceId(identifier)
      : isValidFishIdentifier(normalizedIdentifier),
    retry: retryTransientQueryOnce,
  });
}

export function useFishPrices(id: number, days = 14) {
  return useQuery({
    queryKey: ['fish', id, 'prices', days],
    queryFn: () => getFishPrices(id, days),
    enabled: isValidResourceId(id),
    retry: retryTransientQueryOnce,
    staleTime: 5 * 60 * 1000,
  });
}
