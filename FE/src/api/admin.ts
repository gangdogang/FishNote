import { apiClient } from './client';
import type { FishCategory } from '../types/fish';

export type CorrectionStatus = 'PENDING' | 'RESOLVED' | 'REJECTED';

export interface AdminAuditLog {
  id: number;
  actorNickname: string;
  action: string;
  targetType: string;
  targetId: string | null;
  summary: string;
  createdAt: string;
}

export interface AdminOverview {
  fishCount: number;
  reviewCount: number;
  pendingCorrectionCount: number;
  userCount: number;
  recentActions: AdminAuditLog[];
}

export interface AdminFish {
  id: number;
  name: string;
  nameEn: string | null;
  slug: string;
  category: FishCategory;
  scientificName: string | null;
  imageUrl: string | null;
  tasteDesc: string | null;
  priceLevel: number | null;
  featured: boolean;
  description: string | null;
  seasonMonths: number[];
  tasteTags: string[];
  tips: string[];
  aliases: string[];
  updatedAt: string | null;
}

export type AdminFishInput = Omit<AdminFish, 'id' | 'updatedAt'>;

export interface AdminCorrection {
  id: number;
  fishId: number;
  fishName: string;
  claimType: string;
  message: string;
  sourceUrl: string | null;
  status: CorrectionStatus;
  createdAt: string;
  resolvedAt: string | null;
}

export interface AdminReview {
  id: number;
  fishId: number;
  fishName: string;
  nickname: string;
  rating: number | null;
  content: string;
  imageUrl: string | null;
  helpfulCount: number;
  createdAt: string;
}

export async function getAdminOverview() {
  const { data } = await apiClient.get<AdminOverview>('/admin/overview');
  return data;
}

export async function getAdminFishes() {
  const { data } = await apiClient.get<AdminFish[]>('/admin/fishes');
  return data;
}

export async function createAdminFish(input: AdminFishInput) {
  const { data } = await apiClient.post<AdminFish>('/admin/fishes', input);
  return data;
}

export async function updateAdminFish(id: number, input: AdminFishInput) {
  const { data } = await apiClient.put<AdminFish>(`/admin/fishes/${id}`, input);
  return data;
}

export async function getAdminCorrections(status?: CorrectionStatus) {
  const { data } = await apiClient.get<AdminCorrection[]>('/admin/corrections', {
    params: { status, limit: 100 },
  });
  return data;
}

export async function updateAdminCorrection(id: number, status: CorrectionStatus) {
  const { data } = await apiClient.patch<AdminCorrection>(`/admin/corrections/${id}`, { status });
  return data;
}

export async function getAdminReviews() {
  const { data } = await apiClient.get<AdminReview[]>('/admin/reviews', {
    params: { limit: 100 },
  });
  return data;
}

export async function deleteAdminReview(id: number) {
  await apiClient.delete(`/admin/reviews/${id}`);
}
