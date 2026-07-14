import axios, { AxiosHeaders, type AxiosError } from 'axios';

export const ACCESS_TOKEN_STORAGE_KEY = 'fishnote:accessToken';
export const ACCESS_TOKEN_CHANGE_EVENT = 'fishnote:accessTokenChanged';

function notifyAccessTokenChanged() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(ACCESS_TOKEN_CHANGE_EVENT));
}

export function getStoredAccessToken() {
  if (typeof window === 'undefined') return null;

  try {
    return window.localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setStoredAccessToken(accessToken: string) {
  try {
    window.localStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, accessToken);
    notifyAccessTokenChanged();
  } catch {
    return;
  }
}

export function clearStoredAccessToken() {
  try {
    window.localStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY);
    notifyAccessTokenChanged();
  } catch {
    return;
  }
}

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  timeout: 10_000,
  headers: {
    'Content-Type': 'application/json',
  },
});

function isLoginRequest(url?: string) {
  if (!url) return false;

  try {
    const { pathname } = new URL(url, window.location.origin);
    return pathname.endsWith('/auth/login');
  } catch {
    return url.includes('/auth/login');
  }
}

apiClient.interceptors.request.use((config) => {
  const accessToken = getStoredAccessToken();
  if (!accessToken) return config;

  const headers = AxiosHeaders.from(config.headers);
  headers.set('Authorization', `Bearer ${accessToken}`);
  config.headers = headers;

  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401 && !isLoginRequest(error.config?.url)) {
      clearStoredAccessToken();
    }

    return Promise.reject(error);
  },
);

