export const CLOUDINARY_RESPONSIVE_WIDTHS = [320, 480, 768, 960] as const;

const CLOUDINARY_HOST = 'res.cloudinary.com';
const CLOUDINARY_UPLOAD_MARKER = '/image/upload/';
const OWNED_TRANSFORM_PATTERN = /^f_auto,q_auto,w_\d+,c_limit\//;
const DEFAULT_OPTIMIZED_WIDTH = 800;
const MAX_IMAGE_WIDTH = 8192;

function parseCloudinaryImageUrl(value: string) {
  const protocolRelative = value.startsWith('//');

  try {
    const parsed = new URL(protocolRelative ? `https:${value}` : value);
    if (!['http:', 'https:'].includes(parsed.protocol)) return null;
    if (parsed.hostname.toLowerCase() !== CLOUDINARY_HOST) return null;
    if (!parsed.pathname.includes(CLOUDINARY_UPLOAD_MARKER)) return null;

    return { parsed, protocolRelative };
  } catch {
    return null;
  }
}

function safeWidth(width: number, fallback = DEFAULT_OPTIMIZED_WIDTH) {
  if (!Number.isFinite(width) || width <= 0) return fallback;
  return Math.min(MAX_IMAGE_WIDTH, Math.max(1, Math.round(width)));
}

export function isCloudinaryImageUrl(url: string) {
  return parseCloudinaryImageUrl(url) !== null;
}

/**
 * Adds FishBook's delivery transform while preserving the rest of the Cloudinary
 * path, including caller supplied transforms, version, query string, and hash.
 * Non-Cloudinary values are returned byte-for-byte unchanged.
 */
export function cloudinaryImageUrl(url: string, width = DEFAULT_OPTIMIZED_WIDTH) {
  const cloudinaryUrl = parseCloudinaryImageUrl(url);
  if (!cloudinaryUrl) return url;

  const { parsed, protocolRelative } = cloudinaryUrl;
  const [prefix, rawSuffix = ''] = parsed.pathname.split(CLOUDINARY_UPLOAD_MARKER, 2);
  const suffix = rawSuffix.replace(OWNED_TRANSFORM_PATTERN, '');
  const transform = `f_auto,q_auto,w_${safeWidth(width)},c_limit`;
  parsed.pathname = `${prefix}${CLOUDINARY_UPLOAD_MARKER}${transform}/${suffix}`;

  const result = parsed.toString();
  return protocolRelative ? result.replace(/^https:/, '') : result;
}

export function cloudinarySrcSet(
  url: string,
  widths: readonly number[] = CLOUDINARY_RESPONSIVE_WIDTHS,
) {
  if (!isCloudinaryImageUrl(url)) return undefined;

  const normalizedWidths = Array.from(new Set(widths.map((width) => safeWidth(width))))
    .sort((left, right) => left - right);

  return normalizedWidths
    .map((width) => `${cloudinaryImageUrl(url, width)} ${width}w`)
    .join(', ');
}

// Legacy callers keep the same helper while receiving the stricter URL handling.
export function optimizedImageUrl(url: string, width = DEFAULT_OPTIMIZED_WIDTH) {
  return cloudinaryImageUrl(url, width);
}
