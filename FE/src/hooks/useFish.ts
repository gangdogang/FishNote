import { useQuery } from '@tanstack/react-query';
import { getFishDetail, getFishList } from '../api/fish';
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

export function useFishDetail(id: number) {
  return useQuery({
    queryKey: ['fish', id],
    queryFn: () => getFishDetail(id),
    enabled: Number.isFinite(id),
  });
}
