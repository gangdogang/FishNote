import { useState } from 'react';
import { cloudinaryImageUrl, cloudinarySrcSet } from '../lib/image';
import type { FishMedia } from '../types/fish';
import FishPlaceholder from './FishPlaceholder';

const FALLBACK_WIDTH = 960;
const FALLBACK_HEIGHT = 720;

export interface SmartImageProps {
  media?: FishMedia | null;
  /** Temporary compatibility path while legacy imageUrl fields are still served. */
  legacyUrl?: string | null;
  fallbackName: string;
  decorative?: boolean;
  priority?: boolean;
  sizes: string;
  className?: string;
  onLoadError?: () => void;
}

function validDimension(value: number | undefined, fallback: number) {
  if (value === undefined || !Number.isFinite(value) || value <= 0) return fallback;
  return Math.max(1, Math.round(value));
}

function focalPointPercentage(value: number) {
  if (!Number.isFinite(value)) return 50;
  const percentage = value >= 0 && value <= 1 ? value * 100 : value;
  return Math.min(100, Math.max(0, percentage));
}

function imageSource(media?: FishMedia | null, legacyUrl?: string | null) {
  if (media?.url.trim()) return media.url;
  if (legacyUrl?.trim()) return legacyUrl;
  return null;
}

function safeBlurDataUrl(value?: string | null) {
  if (!value) return null;
  return /^data:image\/(?:png|jpeg|webp|avif);base64,[a-z0-9+/=]+$/i.test(value)
    ? value
    : null;
}

export default function SmartImage({
  media,
  legacyUrl,
  fallbackName,
  decorative = false,
  priority = false,
  sizes,
  className = '',
  onLoadError,
}: SmartImageProps) {
  const source = imageSource(media, legacyUrl);
  const [failedSource, setFailedSource] = useState<string | null>(null);
  const width = validDimension(media?.width, FALLBACK_WIDTH);
  const height = validDimension(media?.height, FALLBACK_HEIGHT);
  const showImage = source !== null && source !== failedSource;
  const accessibleName = fallbackName.trim() || '어종';
  const blurDataUrl = safeBlurDataUrl(media?.blurDataUrl);
  const alt = decorative ? '' : media?.alt.trim() || `${accessibleName} 사진`;
  const objectPosition = media?.focalPoint
    ? `${focalPointPercentage(media.focalPoint.x)}% ${focalPointPercentage(media.focalPoint.y)}%`
    : undefined;
  // React 18 forwards the standards-based lowercase attribute without its
  // unknown-camelCase warning. Browsers expose it as HTMLImageElement.fetchPriority.
  const fetchPriorityAttribute = { fetchpriority: priority ? 'high' : 'auto' };
  const wrapperClassName = [
    'relative flex min-w-0 w-full max-w-full items-center justify-center overflow-hidden bg-mist',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      className={wrapperClassName}
      style={{
        aspectRatio: `${width} / ${height}`,
        ...(blurDataUrl
          ? {
            backgroundImage: `url(${blurDataUrl})`,
            backgroundPosition: 'center',
            backgroundSize: 'cover',
          }
          : {}),
      }}
      data-image-state={showImage ? 'loaded' : failedSource ? 'error' : 'missing'}
      {...(!showImage && decorative ? { 'aria-hidden': true } : {})}
      {...(!showImage && !decorative
        ? { role: 'img', 'aria-label': `${accessibleName} 이미지 준비 중` }
        : {})}
    >
      {showImage ? (
        <img
          src={cloudinaryImageUrl(source, 960)}
          srcSet={cloudinarySrcSet(source)}
          sizes={sizes}
          width={width}
          height={height}
          alt={alt}
          aria-hidden={decorative || undefined}
          loading={priority ? 'eager' : 'lazy'}
          {...fetchPriorityAttribute}
          decoding="async"
          className="h-full min-w-0 w-full max-w-full object-cover"
          style={{ objectPosition }}
          onError={() => {
            setFailedSource(source);
            onLoadError?.();
          }}
        />
      ) : (
        <FishPlaceholder className="h-12 w-[76px] stroke-ink-mute/40" />
      )}
    </div>
  );
}
