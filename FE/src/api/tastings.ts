import { apiClient } from './client';
import type { TastingEntry, TastingEntryPage, TastingEntryRequest } from '../types/tasting';

export const tastingQueryKey = ['tastings', 'me'] as const;

export async function getTastingEntries(page = 0, size = 24) {
  const { data } = await apiClient.get<TastingEntryPage>('/me/tastings', {
    params: { page, size },
  });
  return data;
}

export async function createTastingEntry(request: TastingEntryRequest) {
  const { data } = await apiClient.post<TastingEntry>('/me/tastings', request);
  return data;
}

export async function updateTastingEntry(entryId: number, request: TastingEntryRequest) {
  const { data } = await apiClient.put<TastingEntry>(`/me/tastings/${entryId}`, request);
  return data;
}

export async function deleteTastingEntry(entryId: number) {
  await apiClient.delete(`/me/tastings/${entryId}`);
}
