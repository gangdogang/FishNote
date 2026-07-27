import { useEffect } from 'react';

const DEFAULT_TITLE = 'FishNote — 회 도감 | 제철·맛·가격으로 보는 횟감';
const DEFAULT_DESCRIPTION = '내가 먹는 회가 어떤 횟감인지, 제철·맛·가격을 한눈에. 회 도감 FishNote.';
const DEFAULT_IMAGE = '/fish/gwangeo.jpg';
const MANAGED_JSON_LD_SELECTOR = 'script[type="application/ld+json"][data-fishnote-json-ld]';

type StructuredData = Record<string, unknown> | readonly Record<string, unknown>[];

interface PageMetaOptions {
  canonicalPath?: string;
  noindex?: boolean;
  type?: 'website' | 'article';
  structuredData?: StructuredData;
}

function setMeta(selector: string, content: string) {
  const element = document.querySelector<HTMLMetaElement>(selector);
  if (element) {
    element.setAttribute('content', content);
  }
}

function replaceStructuredData(serializedStructuredData: string | null) {
  document.querySelectorAll(MANAGED_JSON_LD_SELECTOR).forEach((element) => element.remove());
  if (!serializedStructuredData) return;

  const script = document.createElement('script');
  script.type = 'application/ld+json';
  script.dataset.fishnoteJsonLd = 'runtime';
  script.textContent = serializedStructuredData;
  document.head.append(script);
}

function serializeStructuredData(structuredData: StructuredData | undefined) {
  if (!structuredData || (Array.isArray(structuredData) && structuredData.length === 0)) return null;
  return JSON.stringify(structuredData).replace(/</g, '\\u003c');
}

/**
 * 라우트별 document.title / description 동기화 (SPA 동적 메타).
 * title에 페이지 이름만 넘기면 "이름 | FishNote" 형태로 표시된다.
 */
export function usePageMeta(
  title?: string,
  description?: string,
  imageUrl?: string | null,
  options: PageMetaOptions = {},
) {
  const serializedStructuredData = serializeStructuredData(options.structuredData);

  useEffect(() => {
    const nextTitle = title ? `${title} | FishNote` : DEFAULT_TITLE;
    const nextDescription = description ?? DEFAULT_DESCRIPTION;
    const canonicalUrl = new URL(options.canonicalPath ?? window.location.pathname, window.location.origin).toString();
    const socialImageUrl = new URL(imageUrl || DEFAULT_IMAGE, window.location.origin).toString();

    document.title = nextTitle;
    setMeta('meta[name="description"]', nextDescription);
    setMeta('meta[name="robots"]', options.noindex ? 'noindex, nofollow' : 'index, follow');
    setMeta('meta[property="og:type"]', options.type ?? 'website');
    setMeta('meta[property="og:title"]', nextTitle);
    setMeta('meta[property="og:description"]', nextDescription);
    setMeta('meta[property="og:url"]', canonicalUrl);
    setMeta('meta[property="og:image"]', socialImageUrl);
    setMeta('meta[name="twitter:title"]', nextTitle);
    setMeta('meta[name="twitter:description"]', nextDescription);
    setMeta('meta[name="twitter:image"]', socialImageUrl);
    document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.setAttribute('href', canonicalUrl);
    replaceStructuredData(serializedStructuredData);

    return () => {
      const defaultUrl = new URL('/', window.location.origin).toString();
      const defaultImageUrl = new URL(DEFAULT_IMAGE, window.location.origin).toString();
      document.title = DEFAULT_TITLE;
      setMeta('meta[name="description"]', DEFAULT_DESCRIPTION);
      setMeta('meta[name="robots"]', 'index, follow');
      setMeta('meta[property="og:type"]', 'website');
      setMeta('meta[property="og:title"]', DEFAULT_TITLE);
      setMeta('meta[property="og:description"]', DEFAULT_DESCRIPTION);
      setMeta('meta[property="og:url"]', defaultUrl);
      setMeta('meta[property="og:image"]', defaultImageUrl);
      setMeta('meta[name="twitter:title"]', DEFAULT_TITLE);
      setMeta('meta[name="twitter:description"]', DEFAULT_DESCRIPTION);
      setMeta('meta[name="twitter:image"]', defaultImageUrl);
      document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.setAttribute('href', defaultUrl);
      replaceStructuredData(null);
    };
  }, [title, description, imageUrl, options.canonicalPath, options.noindex, options.type, serializedStructuredData]);
}
