import { apiClient } from './client';

export interface AuthResponse {
  accessToken: string;
  nickname: string;
}

export interface AuthUser {
  id: number;
  email: string | null;
  nickname: string;
  hasPassword: boolean;
  role: 'USER' | 'ADMIN';
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface SignupRequest extends LoginRequest {
  nickname: string;
}

export interface KakaoLoginRequest {
  code: string;
  redirectUri: string;
}

export async function login(email: string, password: string) {
  const { data } = await apiClient.post<AuthResponse>('/auth/login', { email, password });
  return data;
}

export async function signup(email: string, password: string, nickname: string) {
  const { data } = await apiClient.post<AuthResponse | AuthUser>('/auth/signup', {
    email,
    password,
    nickname,
  });

  if ('accessToken' in data) return data;
  return login(email, password);
}

export async function getMe() {
  const { data } = await apiClient.get<AuthUser>('/auth/me');
  return data;
}

export async function loginWithKakao(code: string, redirectUri: string) {
  const { data } = await apiClient.post<AuthResponse>('/auth/kakao', { code, redirectUri });
  return data;
}

export async function deleteAccount(password?: string) {
  await apiClient.delete('/auth/me', { data: password ? { password } : {} });
}
