import { apiClient } from './client';
import type { FishSummary } from '../types/fish';

export const bookmarksMeQueryKey = ['bookmarks', 'me'] as const;

export async function getMyBookmarks() {
  const { data } = await apiClient.get<FishSummary[]>('/me/bookmarks');
  return data;
}

export async function addMyBookmark(fishId: number) {
  await apiClient.put<void>(`/me/bookmarks/${fishId}`);
}

export async function deleteMyBookmark(fishId: number) {
  await apiClient.delete<void>(`/me/bookmarks/${fishId}`);
}

export async function mergeMyBookmarks(fishIds: number[]) {
  await apiClient.post<void>('/me/bookmarks/merge', { fishIds });
}
