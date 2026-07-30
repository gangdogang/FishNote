import { createContext, createElement, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { addMyBookmark, bookmarksMeQueryKey, deleteMyBookmark, getMyBookmarks } from '../api/bookmarks';
import {
  readLocalBookmarks,
  subscribeLocalBookmarks,
  writeLocalBookmarks,
} from '../lib/bookmarkStorage';
import type { FishCategory, FishMedia, FishSummary } from '../types/fish';
import { useToast } from './useToast';
import { useAuth } from './useAuth';
import { trackAnalyticsEvent } from '../lib/analytics';

type BookmarkSnapshot = number[];

interface ToggleBookmarkVariables {
  fishId: number;
  shouldBookmark: boolean;
  authScope: string;
}

interface ToggleBookmarkContext {
  previousFish: FishSummary;
  wasBookmarked: boolean;
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
  const pendingFishScopesRef = useRef(new Map<number, string>());
  const [pendingFishScopes, setPendingFishScopes] = useState<ReadonlyMap<number, string>>(() => new Map());
  const currentAccessTokenRef = useRef(accessToken);
  useEffect(() => {
    currentAccessTokenRef.current = accessToken;
  }, [accessToken]);

  const toggleBookmarkMutation = useMutation<void, unknown, ToggleBookmarkVariables, ToggleBookmarkContext>({
    mutationFn: ({ fishId, shouldBookmark }) => (shouldBookmark ? addMyBookmark(fishId) : deleteMyBookmark(fishId)),
    onMutate: async ({ fishId, shouldBookmark }) => {
      await queryClient.cancelQueries({ queryKey: bookmarksMeQueryKey });

      const previousBookmarks = queryClient.getQueryData<FishSummary[]>(bookmarksMeQueryKey) ?? [];
      const previousFish = previousBookmarks.find((fish) => fish.id === fishId)
        ?? findCachedFishSummary(queryClient, fishId)
        ?? createOptimisticFishSummary(fishId);
      const wasBookmarked = previousBookmarks.some((fish) => fish.id === fishId);

      queryClient.setQueryData<FishSummary[]>(bookmarksMeQueryKey, (currentBookmarks = []) => {
        if (shouldBookmark) {
          if (currentBookmarks.some((fish) => fish.id === fishId)) return currentBookmarks;
          return [...currentBookmarks, previousFish];
        }

        return currentBookmarks.filter((fish) => fish.id !== fishId);
      });

      return { previousFish, wasBookmarked };
    },
    onError: (_error, { fishId, shouldBookmark, authScope }, context) => {
      if (currentAccessTokenRef.current !== authScope) return;
      queryClient.setQueryData<FishSummary[]>(bookmarksMeQueryKey, (currentBookmarks = []) => {
        if (context?.wasBookmarked) {
          if (currentBookmarks.some((fish) => fish.id === fishId)) return currentBookmarks;
          return [...currentBookmarks, context.previousFish];
        }
        return currentBookmarks.filter((fish) => fish.id !== fishId);
      });
      showToast(shouldBookmark
        ? '저장하지 못했어요. 다시 시도해 주세요'
        : '저장 해제를 완료하지 못했어요. 다시 시도해 주세요');
    },
    onSuccess: (_data, { fishId, shouldBookmark, authScope }) => {
      if (currentAccessTokenRef.current !== authScope) return;
      trackAnalyticsEvent('bookmark_changed', {
        fishId,
        action: shouldBookmark ? 'saved' : 'removed',
        authenticated: true,
      });
      if (shouldBookmark) showToast('내 도감에 저장했어요');
    },
    onSettled: (_data, _error, { fishId, authScope }) => {
      if (pendingFishScopesRef.current.get(fishId) === authScope) {
        pendingFishScopesRef.current.delete(fishId);
        setPendingFishScopes(new Map(pendingFishScopesRef.current));
      }
      const hasPendingInScope = [...pendingFishScopesRef.current.values()]
        .some((scope) => scope === authScope);
      if (!hasPendingInScope && currentAccessTokenRef.current === authScope) {
        queryClient.invalidateQueries({ queryKey: bookmarksMeQueryKey });
      }
    },
  });

  const isBookmarked = useCallback((fishId: number) => bookmarkedIdSet.has(fishId), [bookmarkedIdSet]);
  const isBookmarkPending = useCallback(
    (fishId: number) => Boolean(accessToken) && pendingFishScopes.get(fishId) === accessToken,
    [accessToken, pendingFishScopes],
  );

  const toggleBookmark = useCallback(
    (fishId: number) => {
      if (!accessToken) {
        const currentIds = readLocalBookmarks();
        const isAdding = !currentIds.includes(fishId);
        const nextIds = isAdding ? [...currentIds, fishId] : currentIds.filter((id) => id !== fishId);

        writeLocalBookmarks(nextIds);
        trackAnalyticsEvent('bookmark_changed', {
          fishId,
          action: isAdding ? 'saved' : 'removed',
          authenticated: false,
        });
        if (isAdding) {
          // 익명 저장은 이 기기에만 남는다는 사실을 저장 시점에 알려 로그인 전환 기회를 만든다
          showToast('저장했어요 · 로그인하면 다른 기기에서도 볼 수 있어요');
        }
        return;
      }

      if (pendingFishScopesRef.current.get(fishId) === accessToken) return;
      pendingFishScopesRef.current.set(fishId, accessToken);
      setPendingFishScopes(new Map(pendingFishScopesRef.current));
      const shouldBookmark = !bookmarkedIdSet.has(fishId);
      toggleBookmarkMutation.mutate({ fishId, shouldBookmark, authScope: accessToken });
    },
    [accessToken, bookmarkedIdSet, showToast, toggleBookmarkMutation],
  );

  // Provider value로 내려가므로 참조 안정성 필수 — 매 렌더 새 객체면 모든 소비자(FishCard 등)가 리렌더됨
  return useMemo(
    () => ({
      bookmarkedIds,
      bookmarkedIdSet,
      bookmarkedFishes: serverBookmarks,
      bookmarkCount: bookmarkedIds.length,
      isBookmarked,
      isBookmarkPending,
      toggleBookmark,
      isServerMode,
      isBookmarkMutationPending: isServerMode && [...pendingFishScopes.values()]
        .some((scope) => scope === accessToken),
      isLoading: isServerMode ? bookmarksQuery.isLoading : false,
      isError: isServerMode ? bookmarksQuery.isError : false,
      refetchBookmarks: bookmarksQuery.refetch,
    }),
    [
      bookmarkedIds,
      bookmarkedIdSet,
      serverBookmarks,
      isBookmarked,
      isBookmarkPending,
      toggleBookmark,
      isServerMode,
      pendingFishScopes,
      accessToken,
      bookmarksQuery.isLoading,
      bookmarksQuery.isError,
      bookmarksQuery.refetch,
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

  const directMatch = normalizeFishSummary(value, fishId);
  if (directMatch) return directMatch;
  if (!value || typeof value !== 'object') return null;

  const container = value as { items?: unknown; pages?: unknown };
  return findFishSummaryInValue(container.items, fishId)
    ?? findFishSummaryInValue(container.pages, fishId);
}

function normalizeFishSummary(value: unknown, fishId: number): FishSummary | null {
  if (!value || typeof value !== 'object') return null;

  const maybeFish = value as Partial<FishSummary>;
  if (maybeFish.id !== fishId || typeof maybeFish.name !== 'string') return null;

  return {
    id: maybeFish.id,
    slug: typeof maybeFish.slug === 'string' ? maybeFish.slug : null,
    category: normalizeFishCategory(maybeFish.category),
    name: maybeFish.name,
    media: normalizeFishMedia(maybeFish.media),
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
    slug: null,
    category: 'FISH',
    name: '저장한 횟감',
    media: null,
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

function normalizeFishCategory(value: unknown): FishCategory {
  return value === 'SHELLFISH' || value === 'CEPHALOPOD' ? value : 'FISH';
}

function normalizeFishMedia(value: unknown): FishMedia | null {
  if (!value || typeof value !== 'object') return null;

  const media = value as Partial<FishMedia>;
  if (
    typeof media.id !== 'string'
    || typeof media.url !== 'string'
    || typeof media.width !== 'number'
    || !Number.isFinite(media.width)
    || media.width <= 0
    || typeof media.height !== 'number'
    || !Number.isFinite(media.height)
    || media.height <= 0
    || typeof media.alt !== 'string'
    || (media.role !== 'PRIMARY' && media.role !== 'GALLERY')
  ) {
    return null;
  }

  const normalized: FishMedia = {
    id: media.id,
    url: media.url,
    width: media.width,
    height: media.height,
    alt: media.alt,
    role: media.role,
  };
  if (typeof media.credit === 'string') normalized.credit = media.credit;
  if (typeof media.sourceUrl === 'string') normalized.sourceUrl = media.sourceUrl;
  if (typeof media.license === 'string') normalized.license = media.license;
  if (typeof media.blurDataUrl === 'string') normalized.blurDataUrl = media.blurDataUrl;
  if (
    media.focalPoint
    && Number.isFinite(media.focalPoint.x)
    && Number.isFinite(media.focalPoint.y)
  ) {
    normalized.focalPoint = { x: media.focalPoint.x, y: media.focalPoint.y };
  }
  return normalized;
}
