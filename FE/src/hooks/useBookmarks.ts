import { createContext, createElement, useCallback, useContext, useMemo, useSyncExternalStore, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { addMyBookmark, bookmarksMeQueryKey, deleteMyBookmark, getMyBookmarks } from '../api/bookmarks';
import {
  readLocalBookmarks,
  subscribeLocalBookmarks,
  writeLocalBookmarks,
} from '../lib/bookmarkStorage';
import type { FishSummary } from '../types/fish';
import { useToast } from '../components/Toast';
import { useAuth } from './useAuth';

type BookmarkSnapshot = number[];

interface ToggleBookmarkVariables {
  fishId: number;
  shouldBookmark: boolean;
}

interface ToggleBookmarkContext {
  previousBookmarks: FishSummary[] | undefined;
}

const emptySnapshot: BookmarkSnapshot = [];
const emptyServerBookmarks: FishSummary[] = [];

function useBookmarksState() {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const { accessToken } = useAuth();
  const isServerMode = Boolean(accessToken);
  const localBookmarkedIds = useSyncExternalStore(subscribeLocalBookmarks, readLocalBookmarks, () => emptySnapshot);
  const bookmarksQuery = useQuery({
    queryKey: bookmarksMeQueryKey,
    queryFn: getMyBookmarks,
    enabled: isServerMode,
  });
  const serverBookmarks = isServerMode ? bookmarksQuery.data ?? emptyServerBookmarks : emptyServerBookmarks;
  const serverBookmarkedIds = useMemo(() => serverBookmarks.map((fish) => fish.id), [serverBookmarks]);
  const bookmarkedIds = isServerMode ? serverBookmarkedIds : localBookmarkedIds;
  const bookmarkedIdSet = useMemo(() => new Set(bookmarkedIds), [bookmarkedIds]);

  const toggleBookmarkMutation = useMutation<void, unknown, ToggleBookmarkVariables, ToggleBookmarkContext>({
    mutationFn: ({ fishId, shouldBookmark }) => (shouldBookmark ? addMyBookmark(fishId) : deleteMyBookmark(fishId)),
    onMutate: async ({ fishId, shouldBookmark }) => {
      await queryClient.cancelQueries({ queryKey: bookmarksMeQueryKey });

      const previousBookmarks = queryClient.getQueryData<FishSummary[]>(bookmarksMeQueryKey);
      const optimisticFish = findCachedFishSummary(queryClient, fishId) ?? createOptimisticFishSummary(fishId);

      queryClient.setQueryData<FishSummary[]>(bookmarksMeQueryKey, (currentBookmarks = []) => {
        if (shouldBookmark) {
          if (currentBookmarks.some((fish) => fish.id === fishId)) return currentBookmarks;
          return [...currentBookmarks, optimisticFish];
        }

        return currentBookmarks.filter((fish) => fish.id !== fishId);
      });

      return { previousBookmarks };
    },
    onError: (_error, _variables, context) => {
      queryClient.setQueryData(bookmarksMeQueryKey, context?.previousBookmarks ?? []);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: bookmarksMeQueryKey });
    },
  });

  const isBookmarked = useCallback((fishId: number) => bookmarkedIdSet.has(fishId), [bookmarkedIdSet]);

  const toggleBookmark = useCallback(
    (fishId: number) => {
      if (!isServerMode) {
        const currentIds = readLocalBookmarks();
        const isAdding = !currentIds.includes(fishId);
        const nextIds = isAdding ? [...currentIds, fishId] : currentIds.filter((id) => id !== fishId);

        writeLocalBookmarks(nextIds);
        if (isAdding) {
          // 익명 저장은 이 기기에만 남는다는 사실을 저장 시점에 알려 로그인 전환 기회를 만든다
          showToast('저장했어요 · 로그인하면 다른 기기에서도 볼 수 있어요');
        }
        return;
      }

      const shouldBookmark = !bookmarkedIdSet.has(fishId);
      toggleBookmarkMutation.mutate({ fishId, shouldBookmark });
      if (shouldBookmark) {
        showToast('내 도감에 저장했어요');
      }
    },
    [bookmarkedIdSet, isServerMode, showToast, toggleBookmarkMutation],
  );

  // Provider value로 내려가므로 참조 안정성 필수 — 매 렌더 새 객체면 모든 소비자(FishCard 등)가 리렌더됨
  return useMemo(
    () => ({
      bookmarkedIds,
      bookmarkedIdSet,
      bookmarkedFishes: serverBookmarks,
      bookmarkCount: bookmarkedIds.length,
      isBookmarked,
      toggleBookmark,
      isServerMode,
      isLoading: isServerMode ? bookmarksQuery.isLoading : false,
      isError: isServerMode ? bookmarksQuery.isError : false,
    }),
    [
      bookmarkedIds,
      bookmarkedIdSet,
      serverBookmarks,
      isBookmarked,
      toggleBookmark,
      isServerMode,
      bookmarksQuery.isLoading,
      bookmarksQuery.isError,
    ],
  );
}

type BookmarksContextValue = ReturnType<typeof useBookmarksState>;

const BookmarksContext = createContext<BookmarksContextValue | null>(null);

export function BookmarkProvider({ children }: { children: ReactNode }) {
  const value = useBookmarksState();
  return createElement(BookmarksContext.Provider, { value }, children);
}

export function useBookmarks() {
  const context = useContext(BookmarksContext);
  if (!context) throw new Error('useBookmarks must be used within BookmarkProvider');
  return context;
}

function findCachedFishSummary(queryClient: QueryClient, fishId: number) {
  const fishQueries = queryClient.getQueriesData<unknown>({ queryKey: ['fish'] });

  for (const [, data] of fishQueries) {
    const fish = findFishSummaryInValue(data, fishId);
    if (fish) return fish;
  }

  return null;
}

function findFishSummaryInValue(value: unknown, fishId: number): FishSummary | null {
  if (Array.isArray(value)) {
    for (const item of value) {
      const fish = normalizeFishSummary(item, fishId);
      if (fish) return fish;
    }

    return null;
  }

  return normalizeFishSummary(value, fishId);
}

function normalizeFishSummary(value: unknown, fishId: number): FishSummary | null {
  if (!value || typeof value !== 'object') return null;

  const maybeFish = value as Partial<FishSummary>;
  if (maybeFish.id !== fishId || typeof maybeFish.name !== 'string') return null;

  return {
    id: maybeFish.id,
    name: maybeFish.name,
    imageUrl: typeof maybeFish.imageUrl === 'string' ? maybeFish.imageUrl : null,
    description: typeof maybeFish.description === 'string' ? maybeFish.description : null,
    priceLevel: typeof maybeFish.priceLevel === 'number' ? maybeFish.priceLevel : null,
    tasteTags: Array.isArray(maybeFish.tasteTags) ? maybeFish.tasteTags.filter((tag) => typeof tag === 'string') : [],
    seasonMonths: Array.isArray(maybeFish.seasonMonths)
      ? maybeFish.seasonMonths.filter((month) => Number.isInteger(month) && month > 0)
      : [],
    featured: typeof maybeFish.featured === 'boolean' ? maybeFish.featured : false,
    avgRating: typeof maybeFish.avgRating === 'number' ? maybeFish.avgRating : 0,
    reviewCount: typeof maybeFish.reviewCount === 'number' ? maybeFish.reviewCount : 0,
  };
}

function createOptimisticFishSummary(fishId: number): FishSummary {
  return {
    id: fishId,
    name: '저장한 생선',
    imageUrl: null,
    description: null,
    priceLevel: null,
    tasteTags: [],
    seasonMonths: [],
    featured: false,
    avgRating: 0,
    reviewCount: 0,
  };
}
