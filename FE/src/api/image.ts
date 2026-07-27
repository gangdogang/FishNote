import { apiClient } from './client';

interface ImageUploadResponse {
  url: string;
  assetId: string;
  expiresAt: string;
}

export async function uploadImage(file: File) {
  const formData = new FormData();
  formData.append('file', file);

  const { data } = await apiClient.post<ImageUploadResponse>('/images', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return data;
}
