import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  createTastingEntry,
  deleteTastingEntry,
  getTastingEntries,
  tastingQueryKey,
  updateTastingEntry,
} from '../api/tastings';
import type { TastingEntryRequest } from '../types/tasting';

export function useTastingEntries(enabled = true) {
  return useInfiniteQuery({
    queryKey: tastingQueryKey,
    queryFn: ({ pageParam }) => getTastingEntries(pageParam, 24),
    initialPageParam: 0,
    getNextPageParam: (lastPage) => (lastPage.hasNext ? lastPage.page + 1 : undefined),
    enabled,
  });
}

export function useCreateTastingEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createTastingEntry,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: tastingQueryKey }),
  });
}

export function useUpdateTastingEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ entryId, request }: { entryId: number; request: TastingEntryRequest }) =>
      updateTastingEntry(entryId, request),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: tastingQueryKey }),
  });
}

export function useDeleteTastingEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteTastingEntry,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: tastingQueryKey }),
  });
}
