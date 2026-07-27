import type { Page } from '@playwright/test';

export const primaryFishMedia = {
  id: 'gwangeo-primary',
  url: '/fish/gwangeo.jpg',
  width: 600,
  height: 407,
  alt: '광어 회 대표 사진',
  role: 'PRIMARY' as const,
  credit: 'FishNote 테스트 촬영',
  sourceUrl: 'https://example.com/fish/gwangeo',
  license: 'CC BY 4.0',
  focalPoint: { x: 0.5, y: 0.45 },
};

export const galleryFishMedia = {
  id: 'gwangeo-gallery',
  url: '/fish/chamdom.jpg',
  width: 678,
  height: 452,
  alt: '광어 회 갤러리 사진',
  role: 'GALLERY' as const,
  credit: 'FishNote 테스트 자료실',
  sourceUrl: 'https://example.com/fish/gwangeo/gallery',
  license: 'CC BY-SA 4.0',
};

const fishFixture = {
  id: 1,
  slug: 'gwangeo',
  category: 'FISH',
  name: '광어',
  media: primaryFishMedia,
  imageUrl: '/fish/gwangeo.jpg',
  description: '담백하고 쫄깃한 입문용 횟감',
  priceLevel: 2,
  tasteTags: ['담백한', '쫄깃한'],
  seasonMonths: [3, 4, 5],
  featured: true,
  avgRating: 4.5,
  reviewCount: 12,
};

export const fishDetailFixture = {
  ...fishFixture,
  nameEn: 'Olive flounder',
  scientificName: 'Paralichthys olivaceus',
  aliases: ['넙치', '광어회용 양식 넙치'],
  verificationStatus: 'VERIFIED',
  galleryMedia: [galleryFishMedia],
  images: ['/fish/gwangeo.jpg'],
  tasteDesc: '담백한 맛과 쫄깃한 식감이 조화로워요.',
  ratingDistribution: { '1': 0, '2': 0, '3': 1, '4': 4, '5': 7 },
  tips: ['얇게 썰어 식감을 즐겨보세요.'],
  similarFishes: [],
};

const emptyPriceSummary = {
  fishId: 1,
  days: 14,
  observationCount: 1,
  latest: {
    observedAt: '2026-07-20T00:00:00Z',
    priceMinKrw: 123_000,
    priceMaxKrw: 456_000,
    unit: 'kg',
    origin: '국내산',
    sizeGrade: null,
    sourceLabel: '테스트 시세',
    shopName: null,
  },
  recent: [],
  dailyAverage: [],
  byShop: [],
  byVariant: [],
};

const emptyReviewList = {
  fishId: 1,
  avgRating: 4.5,
  totalCount: 12,
  ratingDistribution: fishDetailFixture.ratingDistribution,
  reviews: [],
  page: 0,
  size: 20,
  hasNext: false,
};

export const fishSourceFixture = {
  fishId: 1,
  fishName: '광어',
  summary: {
    verificationStatus: 'PARTIALLY_VERIFIED',
    lastVerifiedAt: '2026-07-15T00:00:00Z',
    sourceCount: 1,
  },
  claims: [
    {
      claimType: 'IDENTITY',
      verificationStatus: 'UNVERIFIED',
      lastVerifiedAt: null,
      sourceCount: 0,
      sources: [],
    },
    {
      claimType: 'SEASON',
      verificationStatus: 'VERIFIED',
      lastVerifiedAt: '2026-07-15T00:00:00Z',
      sourceCount: 1,
      sources: [{
        id: 1,
        claimType: 'SEASON',
        publisher: '인천광역시 수산자원연구소',
        title: '2026년 4월, 어식백세 수산물 “가자미, 홍어”',
        url: 'https://www.incheon.go.kr/fish/FI020401/3067203',
        publishedAt: '2026-04-03',
        verifiedAt: '2026-07-15T00:00:00Z',
        license: '공공누리 제1유형(출처표시)',
        confidence: 'HIGH',
      }],
    },
    ...(['TASTE', 'PRICE', 'PHOTO'] as const).map((claimType) => ({
      claimType,
      verificationStatus: 'UNVERIFIED',
      lastVerifiedAt: null,
      sourceCount: 0,
      sources: [],
    })),
  ],
};

export async function mockPublicApi(
  page: Page,
  options: { catalogV2?: boolean } = {},
) {
  await page.route('**/api/v1/me/bookmarks**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify([]),
    });
  });

  if (options.catalogV2) {
    await page.route('**/api/v2/fish**', async (route) => {
      const requestUrl = new URL(route.request().url());
      if (requestUrl.pathname !== '/api/v2/fish') {
        await route.continue();
        return;
      }

      const corsHeaders = {
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
        'Access-Control-Allow-Origin': '*',
      };
      if (route.request().method() === 'OPTIONS') {
        await route.fulfill({ status: 204, headers: corsHeaders });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: corsHeaders,
        body: JSON.stringify({
          items: [fishFixture],
          pageInfo: { nextCursor: null, hasNext: false, limit: 100 },
          facets: { taste: {}, season: {}, priceLevel: {}, category: {} },
        }),
      });
    });
  }

  await page.route('**/api/v1/home**', async (route) => {
    const corsHeaders = {
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
      'Access-Control-Allow-Origin': '*',
    };
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: corsHeaders });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: corsHeaders,
      body: JSON.stringify({
        month: 7,
        generatedAt: '2026-07-23T00:00:00Z',
        seasonal: [fishFixture],
        featured: [fishFixture],
        catalog: [fishFixture],
        facets: { taste: {}, season: {}, priceLevel: {}, category: {} },
      }),
    });
  });

  await page.route('**/api/v1/fish**', async (route) => {
    const requestUrl = new URL(route.request().url());

    const corsHeaders = {
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS, POST',
      'Access-Control-Allow-Origin': '*',
    };

    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: corsHeaders });
      return;
    }

    if (
      route.request().method() === 'POST'
      && requestUrl.pathname === '/api/v1/fish/1/corrections'
    ) {
      await route.fulfill({
        status: 202,
        contentType: 'application/json',
        body: JSON.stringify({ id: 101, status: 'PENDING' }),
        headers: corsHeaders,
      });
      return;
    }

    const responseBody = requestUrl.pathname === '/api/v1/fish'
      ? [fishFixture]
      : requestUrl.pathname === '/api/v1/fish/suggestions'
        ? {
          items: [{
            id: fishFixture.id,
            slug: fishFixture.slug,
            name: fishFixture.name,
            matchedAlias: requestUrl.searchParams.get('q') === '넙치' ? '넙치' : null,
            thumbnail: fishFixture.imageUrl,
          }],
        }
      : requestUrl.pathname === '/api/v1/fish/1' || requestUrl.pathname === '/api/v1/fish/gwangeo'
        ? fishDetailFixture
        : requestUrl.pathname === '/api/v1/fish/1/sources' || requestUrl.pathname === '/api/v1/fish/gwangeo/sources'
          ? fishSourceFixture
        : requestUrl.pathname === '/api/v1/fish/1/prices'
          ? emptyPriceSummary
          : requestUrl.pathname === '/api/v1/fish/1/reviews'
            ? emptyReviewList
            : undefined;

    if (responseBody === undefined) {
      await route.continue();
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(responseBody),
      headers: corsHeaders,
    });
  });

  await page.route('**/_vercel/insights/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/javascript',
      body: '',
    }),
  );
  await page.route('https://va.vercel-scripts.com/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/javascript',
      body: '',
    }),
  );
}
