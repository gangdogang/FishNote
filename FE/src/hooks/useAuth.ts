import { createContext, createElement, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  deleteAccount as deleteAccountRequest,
  getMe,
  login as loginRequest,
  loginWithKakao as kakaoLoginRequest,
  signup as signupRequest,
} from '../api/auth';
import type { AuthResponse, KakaoLoginRequest, LoginRequest, SignupRequest } from '../api/auth';
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

function useAuthState() {
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

  const kakaoLoginMutation = useMutation({
    mutationFn: ({ code, redirectUri }: KakaoLoginRequest) => kakaoLoginRequest(code, redirectUri),
    onSuccess: handleAuthSuccess,
  });

  const logout = useCallback(() => {
    clearStoredAccessToken();
    clearBookmarkMergeDismissed();
    setAccessToken(null);
    queryClient.clear();
  }, [queryClient]);

  const deleteAccountMutation = useMutation({
    mutationFn: ({ password }: { password?: string }) => deleteAccountRequest(password),
    onSuccess: logout,
  });

  // Provider value로 내려가므로 참조 안정성 필수 — 매 렌더 새 객체면 모든 소비자가 리렌더됨.
  // (React Query v5의 query/mutation 결과 객체는 상태가 바뀔 때만 새 참조가 됨)
  return useMemo(
    () => ({
      user: meQuery.data ?? null,
      accessToken,
      isAuthenticated: Boolean(accessToken && meQuery.data),
      isAuthLoading: meQuery.isLoading,
      meQuery,
      login: loginMutation.mutateAsync,
      signup: signupMutation.mutateAsync,
      loginWithKakao: kakaoLoginMutation.mutateAsync,
      deleteAccount: deleteAccountMutation.mutateAsync,
      logout,
      loginMutation,
      signupMutation,
      kakaoLoginMutation,
      deleteAccountMutation,
    }),
    [accessToken, meQuery, loginMutation, signupMutation, kakaoLoginMutation, deleteAccountMutation, logout],
  );
}

type AuthContextValue = ReturnType<typeof useAuthState>;

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const value = useAuthState();
  return createElement(AuthContext.Provider, { value }, children);
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
