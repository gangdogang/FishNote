#!/usr/bin/env node

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const frontendRoot = resolve(scriptDirectory, '..');
const distRoot = resolve(frontendRoot, 'dist');
const catalogPath = resolve(frontendRoot, 'prerender/catalog.json');
const siteUrl = new URL(process.env.PUBLIC_SITE_URL || 'https://www.fishnote.kr');
const defaultImage = new URL('/fish/gwangeo.jpg', siteUrl).toString();
const fixedPublicPages = [
  {
    path: '/calendar',
    title: '제철 캘린더 | FishNote',
    heading: '제철 캘린더',
    description: '월별로 지금 제철인 회를 한눈에 확인해보세요.',
    sections: [
      ['월별 제철 횟감 찾기', '달을 선택하면 그 달에 제철인 횟감을 모아 확인할 수 있습니다. 제철은 산지와 수온, 유통 상황에 따라 달라질 수 있습니다.'],
    ],
  },
  {
    path: '/sources',
    title: '정보 출처 | FishNote',
    heading: '정보 출처',
    description: 'FishNote 횟감·제철·맛 정보의 검수 기준과 출처를 안내합니다.',
    sections: [
      ['정보를 다루는 원칙', 'FishNote는 공공기관 자료와 시장 정보를 교차 확인하고, 제철·맛·가격처럼 주장별로 출처와 검수 상태를 구분합니다.'],
      ['정보 제보', '표준명 혼동이나 제철·맛·가격·사진 오류는 각 횟감 상세 화면에서 제보할 수 있습니다.'],
    ],
  },
  {
    path: '/privacy',
    title: '개인정보처리방침 | FishNote',
    heading: '개인정보처리방침',
    description: 'FishNote는 도감 저장과 후기 기능 제공에 필요한 최소한의 정보만 처리합니다.',
    sections: [
      ['수집하는 정보', '계정과 후기, 서비스 보호에 필요한 최소한의 정보를 처리하며 비회원 도감 저장 정보는 이용자의 브라우저에 저장합니다.'],
      ['이용자의 권리', '로그인 후 계정 관리 화면에서 회원 탈퇴를 요청할 수 있습니다.'],
    ],
  },
  {
    path: '/terms',
    title: '이용약관 | FishNote',
    heading: '이용약관',
    description: 'FishNote를 안전하고 즐겁게 이용하기 위해 필요한 기본 규칙입니다.',
    sections: [
      ['서비스의 목적', 'FishNote는 횟감의 제철, 맛, 가격대와 이용자 후기를 참고할 수 있도록 제공하는 정보 서비스입니다.'],
      ['정보 이용 시 유의사항', '제철과 가격은 산지, 수온, 어획 및 유통 상황에 따라 달라질 수 있으며 서비스 정보는 참고 자료입니다.'],
    ],
  },
];

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function escapeXml(value) {
  return escapeHtml(value);
}

function jsonLd(value) {
  return JSON.stringify(value).replaceAll('<', '\\u003c');
}

function replaceTag(html, pattern, replacement) {
  if (!pattern.test(html)) throw new Error(`prerender template is missing ${replacement}`);
  return html.replace(pattern, replacement);
}

function withMetadata(template, { title, description, canonical, image, type = 'website', robots = 'index, follow' }) {
  let html = template;
  const values = {
    title: escapeHtml(title),
    description: escapeHtml(description),
    canonical: escapeHtml(canonical),
    image: escapeHtml(image),
    type: escapeHtml(type),
    robots: escapeHtml(robots),
  };
  html = replaceTag(html, /<title>[\s\S]*?<\/title>/, `<title>${values.title}</title>`);
  html = replaceTag(html, /<meta\s+name="description"[\s\S]*?\/>/, `<meta name="description" content="${values.description}" />`);
  html = replaceTag(html, /<meta\s+name="robots"[\s\S]*?\/>/, `<meta name="robots" content="${values.robots}" />`);
  html = replaceTag(html, /<meta\s+property="og:type"[\s\S]*?\/>/, `<meta property="og:type" content="${values.type}" />`);
  html = replaceTag(html, /<meta\s+property="og:title"[\s\S]*?\/>/, `<meta property="og:title" content="${values.title}" />`);
  html = replaceTag(html, /<meta\s+property="og:description"[\s\S]*?\/>/, `<meta property="og:description" content="${values.description}" />`);
  html = replaceTag(html, /<meta\s+property="og:url"[\s\S]*?\/>/, `<meta property="og:url" content="${values.canonical}" />`);
  html = replaceTag(html, /<meta\s+property="og:image"[\s\S]*?\/>/, `<meta property="og:image" content="${values.image}" />`);
  html = replaceTag(html, /<meta\s+name="twitter:title"[\s\S]*?\/>/, `<meta name="twitter:title" content="${values.title}" />`);
  html = replaceTag(html, /<meta\s+name="twitter:description"[\s\S]*?\/>/, `<meta name="twitter:description" content="${values.description}" />`);
  html = replaceTag(html, /<meta\s+name="twitter:image"[\s\S]*?\/>/, `<meta name="twitter:image" content="${values.image}" />`);
  html = replaceTag(html, /<link\s+rel="canonical"[\s\S]*?\/>/, `<link rel="canonical" href="${values.canonical}" />`);
  return html;
}

function withStaticRoot(template, markup, structuredData) {
  const scripts = structuredData
    .map((item) => `<script type="application/ld+json" data-fishnote-json-ld="prerender">${jsonLd(item)}</script>`)
    .join('\n    ');
  const withScripts = template.replace('</head>', `    ${scripts}\n  </head>`);
  return replaceTag(
    withScripts,
    /<div id="root"><\/div>/,
    `<div id="root" data-prerendered="true">${markup}</div>`,
  );
}

function seasonSummary(months) {
  if (months.length === 12) return '연중 즐길 수 있어요';
  if (months.length === 0) return '제철 정보를 검수 중이에요';
  return `${months.join('·')}월이 제철이에요`;
}

function normalizeApiCatalog(payload, fallbackCatalog) {
  const items = Array.isArray(payload) ? payload : payload?.items;
  if (!Array.isArray(items)) throw new Error('prerender API response must be an array or contain items');
  const fallbackById = new Map(fallbackCatalog.map((fish) => [fish.id, fish]));
  return items.map((fish) => {
    const fallback = fallbackById.get(fish.id);
    if (!fallback || !fish.slug) throw new Error(`prerender API returned an unknown or slugless fish: ${fish.id}`);
    return {
      id: fish.id,
      name: fish.name,
      slug: fish.slug,
      description: fish.description || fallback.description,
      seasonMonths: Array.isArray(fish.seasonMonths) ? fish.seasonMonths : fallback.seasonMonths,
      imageUrl: fish.media?.url || fish.imageUrl || fallback.imageUrl,
    };
  });
}

async function loadCatalog() {
  const fallbackCatalog = JSON.parse(await readFile(catalogPath, 'utf8'));
  const apiBase = process.env.PRERENDER_API_BASE_URL?.replace(/\/$/, '');
  if (!apiBase) return fallbackCatalog;

  const response = await fetch(`${apiBase}/fish?sort=name`, {
    headers: { accept: 'application/json' },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`prerender API failed with ${response.status}`);
  const apiCatalog = normalizeApiCatalog(await response.json(), fallbackCatalog);
  if (apiCatalog.length !== fallbackCatalog.length) {
    throw new Error(`public fish count mismatch: API=${apiCatalog.length}, expected=${fallbackCatalog.length}`);
  }
  return apiCatalog;
}

function validateCatalog(catalog) {
  const slugs = new Set();
  for (const fish of catalog) {
    if (!Number.isInteger(fish.id) || !fish.name || !fish.slug || !fish.description) {
      throw new Error(`invalid public fish record: ${JSON.stringify(fish)}`);
    }
    if (slugs.has(fish.slug)) throw new Error(`duplicate public fish slug: ${fish.slug}`);
    slugs.add(fish.slug);
  }
  if (catalog.length !== 26) throw new Error(`expected 26 public fish, received ${catalog.length}`);
}

function fishMarkup(fish) {
  const image = fish.imageUrl
    ? `<img src="${escapeHtml(fish.imageUrl)}" alt="${escapeHtml(`${fish.name} 대표 사진`)}" width="640" height="480" />`
    : '<p>사진 준비 중</p>';
  return `<main><article><nav aria-label="경로"><a href="/">FishNote</a> / <span>${escapeHtml(fish.name)}</span></nav><h1>${escapeHtml(fish.name)}</h1><p>${escapeHtml(fish.description)}</p><p>${escapeHtml(seasonSummary(fish.seasonMonths))}</p>${image}<p><a href="/fish/${escapeHtml(fish.slug)}">${escapeHtml(fish.name)} 도감 자세히 보기</a></p></article></main>`;
}

function homeMarkup(catalog) {
  const links = catalog
    .map((fish) => `<li><a href="/fish/${escapeHtml(fish.slug)}">${escapeHtml(fish.name)}</a> — ${escapeHtml(fish.description)}</li>`)
    .join('');
  return `<main><h1>아는 만큼 맛있어지는 회</h1><p>이름·제철·맛·가격대를 FishNote에서 확인하세요.</p><h2>회 도감</h2><ul>${links}</ul></main>`;
}

function fixedPageMarkup(page) {
  const sections = page.sections
    .map(([heading, body]) => `<section><h2>${escapeHtml(heading)}</h2><p>${escapeHtml(body)}</p></section>`)
    .join('');
  return `<main><nav aria-label="경로"><a href="/">FishNote</a> / <span>${escapeHtml(page.heading)}</span></nav><article><h1>${escapeHtml(page.heading)}</h1><p>${escapeHtml(page.description)}</p>${sections}<p><a href="/">전체 회 도감 둘러보기</a></p></article></main>`;
}

const calendarMonths = Array.from({ length: 12 }, (_, index) => index + 1);

function monthFishes(catalog, month) {
  return catalog.filter((fish) => fish.seasonMonths.includes(month));
}

function monthDescription(month, count) {
  return `${month}월이 제철인 회 ${count}종을 확인하세요. 이름·맛·가격대는 FishNote 회 도감에서.`;
}

function monthMarkup(month, fishes) {
  const items = fishes
    .map((fish) => `<li><a href="/fish/${escapeHtml(fish.slug)}">${escapeHtml(fish.name)}</a> — ${escapeHtml(fish.description)}</li>`)
    .join('');
  const otherMonths = calendarMonths
    .filter((other) => other !== month)
    .map((other) => `<a href="/calendar/${other}">${other}월</a>`)
    .join(' ');
  return `<main><nav aria-label="경로"><a href="/">FishNote</a> / <a href="/calendar">제철 캘린더</a> / <span>${month}월</span></nav><article><h1>${month}월 제철 회</h1><p>${escapeHtml(monthDescription(month, fishes.length))}</p><ul>${items}</ul><nav aria-label="다른 달 제철 회"><h2>다른 달 제철 회 보기</h2><p>${otherMonths}</p></nav></article></main>`;
}

function sitemap(catalog) {
  const fixedPaths = ['/', ...fixedPublicPages.map((page) => page.path)];
  const monthPaths = calendarMonths.map((month) => `/calendar/${month}`);
  const paths = [...fixedPaths, ...monthPaths, ...catalog.map((fish) => `/fish/${fish.slug}`)];
  const urls = paths
    .map((path) => `  <url><loc>${escapeXml(new URL(path, siteUrl).toString())}</loc></url>`)
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

const catalog = await loadCatalog();
validateCatalog(catalog);
const template = await readFile(resolve(distRoot, 'index.html'), 'utf8');

const homeCanonical = new URL('/', siteUrl).toString();
const homeDescription = '내가 먹는 회의 이름·제철·맛·가격을 한눈에 확인하는 회 도감 FishNote.';
const homeJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'ItemList',
  name: 'FishNote 공개 회 도감',
  numberOfItems: catalog.length,
  itemListElement: catalog.map((fish, index) => ({
    '@type': 'ListItem',
    position: index + 1,
    name: fish.name,
    url: new URL(`/fish/${fish.slug}`, siteUrl).toString(),
  })),
};
const homeHtml = withStaticRoot(
  withMetadata(template, {
    title: 'FishNote — 회 도감 | 제철·맛·가격으로 보는 횟감',
    description: homeDescription,
    canonical: homeCanonical,
    image: defaultImage,
  }),
  homeMarkup(catalog),
  [homeJsonLd],
);
await writeFile(resolve(distRoot, 'index.html'), homeHtml, 'utf8');

for (const page of fixedPublicPages) {
  const canonical = new URL(page.path, siteUrl).toString();
  const structuredData = [{
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: page.heading,
    description: page.description,
    url: canonical,
    isPartOf: { '@type': 'WebSite', name: 'FishNote', url: homeCanonical },
  }];
  const html = withStaticRoot(
    withMetadata(template, {
      title: page.title,
      description: page.description,
      canonical,
      image: defaultImage,
    }),
    fixedPageMarkup(page),
    structuredData,
  );
  const directory = resolve(distRoot, page.path.slice(1));
  await mkdir(directory, { recursive: true });
  await writeFile(resolve(directory, 'index.html'), html, 'utf8');
}

for (const month of calendarMonths) {
  const fishes = monthFishes(catalog, month);
  const canonical = new URL(`/calendar/${month}`, siteUrl).toString();
  const description = monthDescription(month, fishes.length);
  const image = fishes[0]?.imageUrl || defaultImage;
  const structuredData = [
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'FishNote', item: homeCanonical },
        { '@type': 'ListItem', position: 2, name: '제철 캘린더', item: new URL('/calendar', siteUrl).toString() },
        { '@type': 'ListItem', position: 3, name: `${month}월 제철 회`, item: canonical },
      ],
    },
    {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      name: `${month}월 제철 회`,
      numberOfItems: fishes.length,
      itemListElement: fishes.map((fish, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: fish.name,
        url: new URL(`/fish/${fish.slug}`, siteUrl).toString(),
      })),
    },
  ];
  const html = withStaticRoot(
    withMetadata(template, {
      title: `${month}월 제철 회·횟감 | FishNote`,
      description,
      canonical,
      image,
    }),
    monthMarkup(month, fishes),
    structuredData,
  );
  const directory = resolve(distRoot, 'calendar', String(month));
  await mkdir(directory, { recursive: true });
  await writeFile(resolve(directory, 'index.html'), html, 'utf8');
}

for (const fish of catalog) {
  const canonical = new URL(`/fish/${fish.slug}`, siteUrl).toString();
  const description = `${fish.description}. ${seasonSummary(fish.seasonMonths)} FishNote에서 맛과 가격 정보도 확인하세요.`;
  const image = fish.imageUrl || defaultImage;
  const structuredData = [
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'FishNote', item: homeCanonical },
        { '@type': 'ListItem', position: 2, name: fish.name, item: canonical },
      ],
    },
    {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: `${fish.name} 회 도감`,
      description,
      url: canonical,
      primaryImageOfPage: image,
      isPartOf: { '@type': 'WebSite', name: 'FishNote', url: homeCanonical },
    },
  ];
  const html = withStaticRoot(
    withMetadata(template, {
      title: `${fish.name} 회 도감 | FishNote`,
      description,
      canonical,
      image,
      type: 'article',
    }),
    fishMarkup(fish),
    structuredData,
  );
  const directory = resolve(distRoot, 'fish', fish.slug);
  await mkdir(directory, { recursive: true });
  await writeFile(resolve(directory, 'index.html'), html, 'utf8');
}

const noindexHtml = withMetadata(template, {
  title: 'FishNote',
  description: homeDescription,
  canonical: homeCanonical,
  image: defaultImage,
  robots: 'noindex, nofollow',
});
await writeFile(resolve(distRoot, 'spa-noindex.html'), noindexHtml, 'utf8');
await writeFile(resolve(distRoot, 'sitemap.xml'), sitemap(catalog), 'utf8');

console.log(`prerendered ${catalog.length} fish pages, ${fixedPublicPages.length} fixed pages, ${calendarMonths.length} month pages, and generated sitemap.xml`);
