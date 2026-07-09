import { useCallback, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getMe, login as loginRequest, signup as signupRequest } from '../api/auth';
import type { AuthResponse, LoginRequest, SignupRequest } from '../api/auth';
import { bookmarksMeQueryKey } from '../api/bookmarks';
import {
  ACCESS_TOKEN_CHANGE_EVENT,
  ACCESS_TOKEN_STORAGE_KEY,
  clearStoredAccessToken,
  getStoredAccessToken,
  setStoredAccessToken,
} from '../api/client';
import { clearBookmarkMergeDismissed } from '../lib/bookmarkStorage';

export const authMeQueryKey = ['auth', 'me'] as const;
export const AUTH_SUCCESS_EVENT = 'fishnote:authSucceeded';

function notifyAuthSucceeded() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(AUTH_SUCCESS_EVENT));
}

export function useAuth() {
  const queryClient = useQueryClient();
  const [accessToken, setAccessToken] = useState(() => getStoredAccessToken());

  useEffect(() => {
    function syncAccessToken() {
      const nextAccessToken = getStoredAccessToken();
      setAccessToken(nextAccessToken);
      if (!nextAccessToken) {
        queryClient.removeQueries({ queryKey: authMeQueryKey });
        queryClient.removeQueries({ queryKey: bookmarksMeQueryKey });
        clearBookmarkMergeDismissed();
      }
    }

    function handleStorage(event: StorageEvent) {
      if (event.key === ACCESS_TOKEN_STORAGE_KEY) syncAccessToken();
    }

    window.addEventListener(ACCESS_TOKEN_CHANGE_EVENT, syncAccessToken);
    window.addEventListener('storage', handleStorage);

    return () => {
      window.removeEventListener(ACCESS_TOKEN_CHANGE_EVENT, syncAccessToken);
      window.removeEventListener('storage', handleStorage);
    };
  }, [queryClient]);

  const meQuery = useQuery({
    queryKey: authMeQueryKey,
    queryFn: getMe,
    enabled: Boolean(accessToken),
  });

  const handleAuthSuccess = useCallback(
    async (response: AuthResponse) => {
      setStoredAccessToken(response.accessToken);
      setAccessToken(response.accessToken);
      queryClient.removeQueries({ queryKey: bookmarksMeQueryKey });
      await queryClient.fetchQuery({
        queryKey: authMeQueryKey,
        queryFn: getMe,
      });
      notifyAuthSucceeded();
    },
    [queryClient],
  );

  const loginMutation = useMutation({
    mutationFn: ({ email, password }: LoginRequest) => loginRequest(email, password),
    onSuccess: handleAuthSuccess,
  });

  const signupMutation = useMutation({
    mutationFn: ({ email, password, nickname }: SignupRequest) => signupRequest(email, password, nickname),
    onSuccess: handleAuthSuccess,
  });

  const logout = useCallback(() => {
    clearStoredAccessToken();
    clearBookmarkMergeDismissed();
    setAccessToken(null);
    queryClient.clear();
  }, [queryClient]);

  return {
    user: meQuery.data ?? null,
    accessToken,
    isAuthenticated: Boolean(accessToken && meQuery.data),
    isAuthLoading: meQuery.isLoading,
    meQuery,
    login: loginMutation.mutateAsync,
    signup: signupMutation.mutateAsync,
    logout,
    loginMutation,
    signupMutation,
  };
}
