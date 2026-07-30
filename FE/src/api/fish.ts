import axios from 'axios';
import { apiClient, apiVersionUrl } from './client';
import type {
  FishDetail,
  FishCatalogPage,
  FishFacets,
  FishListParams,
  FishPriceSummary,
  FishSuggestionsResponse,
  FishSummary,
  HomeData,
} from '../types/fish';

interface FishCatalogPageOptions {
  cursor?: string;
  limit?: number;
}

// 운영은 명시적으로 opt-in해야 한다. Vercel 환경변수 누락만으로 신규 API가
// 활성화되지 않게 하고, 개발·테스트에서는 기존의 v2 우선 검증 흐름을 유지한다.
const catalogV2Enabled = import.meta.env.PROD
  ? import.meta.env.VITE_CATALOG_V2_ENABLED === 'true'
  : import.meta.env.VITE_CATALOG_V2_ENABLED !== 'false';

export async function getFishList(params: FishListParams = {}) {
  const page = await getFishCatalogPage(params, { limit: 100 });
  return page.items;
}

export async function getFishCatalogPage(
  params: FishListParams = {},
  options: FishCatalogPageOptions = {},
): Promise<FishCatalogPage> {
  const limit = options.limit ?? 24;
  if (catalogV2Enabled) {
    try {
      const { data } = await apiClient.get<FishCatalogPage>(apiVersionUrl(2, 'fish'), {
        params: {
          ...params,
          limit,
          ...(options.cursor ? { cursor: options.cursor } : {}),
        },
      });
      if (!isFishCatalogV2Response(data)) throw new V2UnavailableError();
      return data;
    } catch (error) {
      if (!canFallbackToV1(error)) throw error;
      // 이미 받은 v2 목록에 v1 첫 페이지를 중복으로 붙이지 않는다.
      if (options.cursor) throw error;
    }
  }

  const { data } = await apiClient.get<FishSummary[]>('/fish', { params });
  return {
    items: data,
    pageInfo: { nextCursor: null, hasNext: false, limit: data.length },
    facets: deriveFacets(data),
  };
}

export async function getHomeData(month: number, sort: 'popular' | 'name' = 'popular') {
  try {
    const { data } = await apiClient.get<HomeData>('/home', { params: { month, sort } });
    return data;
  } catch (error) {
    if (!canFallbackToV1(error)) throw error;
  }

  // Rollback path for a disabled/unavailable home-v2 read model. Keep this
  // intentionally bounded to one legacy catalog request.
  const { data: catalog } = await apiClient.get<FishSummary[]>('/fish', { params: { sort } });
  return {
    month,
    generatedAt: new Date().toISOString(),
    seasonal: catalog.filter((fish) => fish.seasonMonths.includes(month)),
    featured: catalog.filter((fish) => fish.featured),
    catalog,
    facets: deriveFacets(catalog),
  };
}

export async function getFishDetail(identifier: string | number) {
  const encodedIdentifier = encodeURIComponent(String(identifier));
  if (catalogV2Enabled) {
    try {
      const { data } = await apiClient.get<FishDetail>(apiVersionUrl(2, `fish/${encodedIdentifier}`));
      if (!isFishDetail(data)) throw new V2UnavailableError();
      return data;
    } catch (error) {
      if (!canFallbackToV1(error)) throw error;
    }
  }

  const { data } = await apiClient.get<FishDetail>(`/fish/${encodedIdentifier}`);
  return data;
}

export async function getFishSuggestions(query: string, limit = 8, signal?: AbortSignal) {
  const { data } = await apiClient.get<FishSuggestionsResponse>('/fish/suggestions', {
    params: { q: query, limit },
    signal,
  });
  return data;
}

export async function getFishPrices(id: number, days = 14) {
  const { data } = await apiClient.get<FishPriceSummary>(`/fish/${id}/prices`, { params: { days } });
  return data;
}

function canFallbackToV1(error: unknown) {
  if (error instanceof V2UnavailableError) return true;
  if (!axios.isAxiosError(error)) return false;
  const status = error.response?.status;
  return status === undefined || status === 404 || status >= 500;
}

function isFishCatalogV2Response(value: unknown): value is FishCatalogPage {
  if (!value || typeof value !== 'object') return false;
  const response = value as Partial<FishCatalogPage>;
  return Array.isArray(response.items)
    && Boolean(response.pageInfo && typeof response.pageInfo.hasNext === 'boolean')
    && Boolean(response.facets && typeof response.facets === 'object');
}

function isFishDetail(value: unknown): value is FishDetail {
  if (!value || typeof value !== 'object') return false;
  const fish = value as Partial<FishDetail>;
  return typeof fish.id === 'number'
    && Number.isSafeInteger(fish.id)
    && fish.id > 0
    && typeof fish.name === 'string';
}

class V2UnavailableError extends Error {}

function deriveFacets(catalog: FishSummary[]): FishFacets {
  const facets: FishFacets = { taste: {}, season: {}, priceLevel: {}, category: {} };
  for (const fish of catalog) {
    for (const taste of new Set(fish.tasteTags)) increment(facets.taste, taste);
    for (const month of new Set(fish.seasonMonths)) increment(facets.season, String(month));
    if (fish.priceLevel !== null) increment(facets.priceLevel, String(fish.priceLevel));
    increment(facets.category, fish.category ?? 'FISH');
  }
  return facets;
}

function increment(facet: Record<string, number>, key: string) {
  facet[key] = (facet[key] ?? 0) + 1;
}
