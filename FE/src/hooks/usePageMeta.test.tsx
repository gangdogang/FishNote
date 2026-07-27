import { render, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { usePageMeta } from './usePageMeta';

function MetaProbe() {
  usePageMeta('광어', '광어 상세 설명', '/fish/gwangeo.jpg', {
    canonicalPath: '/fish/gwangeo',
    noindex: true,
    type: 'article',
    structuredData: {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: '광어 회 도감',
    },
  });
  return null;
}

describe('usePageMeta', () => {
  afterEach(() => {
    document.head.innerHTML = '';
  });

  it('sets canonical, absolute social image, article type, and noindex policy', async () => {
    document.head.innerHTML = `
      <meta name="description" content="" />
      <meta name="robots" content="index, follow" />
      <meta property="og:type" content="website" />
      <meta property="og:title" content="" />
      <meta property="og:description" content="" />
      <meta property="og:url" content="" />
      <meta property="og:image" content="" />
      <meta name="twitter:title" content="" />
      <meta name="twitter:description" content="" />
      <meta name="twitter:image" content="" />
      <link rel="canonical" href="" />
      <script type="application/ld+json" data-fishnote-json-ld="prerender">{"name":"이전 페이지"}</script>
    `;

    const { unmount } = render(<MetaProbe />);

    await waitFor(() => expect(document.title).toBe('광어 | FishNote'));
    expect(document.querySelector('meta[name="robots"]')).toHaveAttribute('content', 'noindex, nofollow');
    expect(document.querySelector('meta[property="og:type"]')).toHaveAttribute('content', 'article');
    expect(document.querySelector('meta[property="og:image"]')).toHaveAttribute(
      'content',
      'http://localhost:3000/fish/gwangeo.jpg',
    );
    expect(document.querySelector('link[rel="canonical"]')).toHaveAttribute(
      'href',
      'http://localhost:3000/fish/gwangeo',
    );
    const structuredDataScripts = document.querySelectorAll(
      'script[type="application/ld+json"][data-fishnote-json-ld]',
    );
    expect(structuredDataScripts).toHaveLength(1);
    expect(structuredDataScripts[0]).toHaveTextContent('광어 회 도감');
    expect(structuredDataScripts[0]).not.toHaveTextContent('이전 페이지');

    unmount();

    expect(document.querySelector('meta[name="twitter:title"]')).toHaveAttribute(
      'content',
      'FishNote — 회 도감 | 제철·맛·가격으로 보는 횟감',
    );
    expect(document.querySelector('meta[name="twitter:description"]')).toHaveAttribute(
      'content',
      '내가 먹는 회가 어떤 횟감인지, 제철·맛·가격을 한눈에. 회 도감 FishNote.',
    );
    expect(document.querySelector('meta[name="twitter:image"]')).toHaveAttribute(
      'content',
      'http://localhost:3000/fish/gwangeo.jpg',
    );
    expect(document.querySelector('link[rel="canonical"]')).toHaveAttribute('href', 'http://localhost:3000/');
    expect(document.querySelectorAll('script[data-fishnote-json-ld]')).toHaveLength(0);
  });
});
