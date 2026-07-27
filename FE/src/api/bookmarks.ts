import { apiClient } from './client';
import type { FishSummary } from '../types/fish';

export const bookmarksMeQueryKey = ['bookmarks', 'me'] as const;

export interface BookmarkMergeResponse {
  acceptedCount: number;
  skippedCount: number;
}

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
  const { data } = await apiClient.post<BookmarkMergeResponse>('/me/bookmarks/merge', { fishIds });
  return data;
}
