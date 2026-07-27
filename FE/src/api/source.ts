import { apiClient } from './client';
import type {
  FishCorrectionReceipt,
  FishCorrectionRequest,
  FishSourcesResponse,
} from '../types/source';

export async function getFishSources(identifier: string | number) {
  const encodedIdentifier = encodeURIComponent(String(identifier));
  const { data } = await apiClient.get<FishSourcesResponse>(`/fish/${encodedIdentifier}/sources`);
  return data;
}

export async function submitFishCorrection(fishId: number, request: FishCorrectionRequest) {
  const encodedFishId = encodeURIComponent(String(fishId));
  const { data } = await apiClient.post<FishCorrectionReceipt>(
    `/fish/${encodedFishId}/corrections`,
    request,
  );
  return data;
}
