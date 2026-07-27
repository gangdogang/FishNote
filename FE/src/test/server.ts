import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { fishFixture } from './fixtures';

export const server = setupServer(
  http.get('*/home', () =>
    HttpResponse.json({
      month: 7,
      generatedAt: '2026-07-23T00:00:00Z',
      seasonal: [fishFixture],
      featured: [fishFixture],
      catalog: [fishFixture],
      facets: { taste: {}, season: {}, priceLevel: {}, category: {} },
    }, {
      headers: {
        'Access-Control-Allow-Origin': '*',
      },
    }),
  ),
  http.get('*/fish/suggestions', () =>
    HttpResponse.json({
      items: [
        {
          id: fishFixture.id,
          slug: fishFixture.slug ?? null,
          name: fishFixture.name,
          matchedAlias: null,
          thumbnail: fishFixture.imageUrl,
        },
      ],
    }, {
      headers: {
        'Access-Control-Allow-Origin': '*',
      },
    }),
  ),
  http.options('*/fish', () =>
    new HttpResponse(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Origin': '*',
      },
    }),
  ),
  http.get('*/fish', () =>
    HttpResponse.json([fishFixture], {
      headers: {
        'Access-Control-Allow-Origin': '*',
      },
    }),
  ),
);
