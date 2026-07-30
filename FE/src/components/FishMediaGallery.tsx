import { useMemo, useState } from 'react';
import type { FishDetail, FishMedia } from '../types/fish';
import { trackAnalyticsEvent } from '../lib/analytics';
import SmartImage from './SmartImage';

interface FishMediaGalleryProps {
  fish: FishDetail;
  className?: string;
}

interface GalleryImage {
  key: string;
  media?: FishMedia;
  legacyUrl?: string;
}

export default function FishMediaGallery({ fish, className = '' }: FishMediaGalleryProps) {
  const [selection, setSelection] = useState<{ fishId: FishDetail['id']; imageKey: string } | null>(null);
  const [failedImageKey, setFailedImageKey] = useState<string | null>(null);
  const galleryImages = useMemo(() => buildGalleryImages(fish), [fish]);
  const displayedImages = galleryImages.slice(0, 4);
  const selectedImageIndex = selection?.fishId === fish.id
    ? displayedImages.findIndex((image) => image.key === selection.imageKey)
    : -1;
  const effectiveImageIndex = selectedImageIndex >= 0 ? selectedImageIndex : 0;
  const selectedImage = displayedImages[effectiveImageIndex] ?? null;
  const showCompactPlaceholder = selectedImage === null || failedImageKey === selectedImage.key;

  return (
    <div
      className={['min-w-0', className].filter(Boolean).join(' ')}
      role="group"
      aria-label={`${fish.name} 사진 갤러리`}
    >
      <div
        className={[
          'fish-gallery-stage relative flex min-w-0 w-full max-w-full items-center justify-center overflow-hidden rounded-[22px] bg-chipbg transition-[height,max-width] motion-reduce:transition-none',
          showCompactPlaceholder
            ? 'h-36 max-w-[420px] sm:h-44'
            : 'aspect-[4/3] max-h-[420px]',
        ].join(' ')}
      >
        <SmartImage
          key={selectedImage?.key ?? 'placeholder'}
          media={selectedImage?.media}
          legacyUrl={selectedImage?.legacyUrl}
          fallbackName={fish.name}
          priority={effectiveImageIndex === 0 && selectedImage !== null}
          sizes="(max-width: 1023px) calc(100vw - 32px), 480px"
          className="fish-gallery-image h-full rounded-[22px]"
          onLoadError={() => setFailedImageKey(selectedImage?.key ?? null)}
        />
        {!showCompactPlaceholder && displayedImages.length > 1 ? (
          <span
            aria-live="polite"
            className="absolute right-3 top-3 rounded-full border border-white/20 bg-[#061c25]/[0.55] px-2.5 py-1 text-caption font-bold tabular-nums text-white shadow-sm backdrop-blur-md"
          >
            {effectiveImageIndex + 1} / {displayedImages.length}
          </span>
        ) : null}
        {showCompactPlaceholder ? (
          <span className="pointer-events-none absolute bottom-4 rounded-full bg-surface/90 px-3 py-1 text-xs font-semibold text-ink-mute">
            사진 준비 중
          </span>
        ) : null}
      </div>

      {galleryImages.length > 0 ? (
        <div className="mt-2 grid grid-cols-4 gap-2" role="group" aria-label="사진 선택">
          {displayedImages.map((image, index) => (
            <button
              key={image.key}
              type="button"
              onClick={() => setSelection({ fishId: fish.id, imageKey: image.key })}
              className={[
                'aspect-[4/3] min-h-11 min-w-0 overflow-hidden rounded-[10px] bg-chipbg outline-offset-2 transition duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus motion-reduce:transition-none',
                effectiveImageIndex === index
                  ? '-translate-y-0.5 outline outline-2 outline-accent shadow-[0_8px_18px_rgba(10,40,54,0.12)] motion-reduce:transform-none'
                  : 'outline outline-1 outline-transparent hover:-translate-y-0.5 hover:outline-line motion-reduce:transform-none',
              ].join(' ')}
              aria-label={`${fish.name} 이미지 ${index + 1}`}
              aria-pressed={effectiveImageIndex === index}
            >
              <SmartImage
                media={image.media}
                legacyUrl={image.legacyUrl}
                fallbackName={fish.name}
                decorative
                sizes="(max-width: 639px) 22vw, 120px"
                className="h-full"
              />
            </button>
          ))}
        </div>
      ) : null}

      <MediaAttribution fishId={fish.id} media={selectedImage?.media} />
    </div>
  );
}

function buildGalleryImages(fish: FishDetail): GalleryImage[] {
  const modernMedia = [fish.media, ...(fish.galleryMedia ?? [])]
    .filter((media): media is FishMedia => Boolean(media?.url?.trim()))
    .sort((left, right) => Number(right.role === 'PRIMARY') - Number(left.role === 'PRIMARY'));

  if (modernMedia.length > 0) {
    const seenUrls = new Set<string>();
    return modernMedia.flatMap((media) => {
      const normalizedUrl = media.url.trim();
      if (seenUrls.has(normalizedUrl)) return [];
      seenUrls.add(normalizedUrl);
      return [{ key: `${media.id}:${normalizedUrl}`, media }];
    });
  }

  const legacyCandidates = (fish.images ?? []).filter((url): url is string => Boolean(url?.trim()));
  if (legacyCandidates.length === 0 && fish.imageUrl?.trim()) legacyCandidates.push(fish.imageUrl);

  const seenUrls = new Set<string>();
  return legacyCandidates.flatMap((url) => {
    const normalizedUrl = url.trim();
    if (seenUrls.has(normalizedUrl)) return [];
    seenUrls.add(normalizedUrl);
    return [{ key: `legacy:${normalizedUrl}`, legacyUrl: normalizedUrl }];
  });
}

function MediaAttribution({ fishId, media }: { fishId: number; media?: FishMedia }) {
  const credit = media?.credit;
  const license = media?.license;
  const sourceUrl = safeExternalUrl(media?.sourceUrl);
  if (!credit && !license && !sourceUrl) return null;

  return (
    <p
      role="group"
      className="m-0 mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-caption leading-5 text-ink-mute"
      aria-label="사진 정보"
      data-media-attribution
    >
      {credit ? <span>사진: {credit}</span> : null}
      {license ? <span>라이선스: {license}</span> : null}
      {sourceUrl ? (
        <a
          href={sourceUrl}
          onClick={() => trackAnalyticsEvent('source_link_clicked', { fishId, claimType: 'PHOTO' })}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-11 items-center font-semibold text-accent underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
        >
          원문 보기
        </a>
      ) : null}
    </p>
  );
}

function safeExternalUrl(value?: string) {
  if (!value) return null;
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? value : null;
  } catch {
    return null;
  }
}
