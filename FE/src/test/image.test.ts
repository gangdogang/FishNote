import { describe, expect, it } from 'vitest';
import {
  CLOUDINARY_RESPONSIVE_WIDTHS,
  cloudinaryImageUrl,
  cloudinarySrcSet,
  isCloudinaryImageUrl,
  optimizedImageUrl,
} from '../lib/image';

describe('Cloudinary image helpers', () => {
  const original =
    'https://res.cloudinary.com/fish-note/image/upload/c_fill,g_auto/v1720000000/fish/gwangeo.jpg?version=2#photo';

  it('Cloudinary transform, version, query, hash를 보존하며 responsive URL을 만든다', () => {
    expect(cloudinaryImageUrl(original, 480)).toBe(
      'https://res.cloudinary.com/fish-note/image/upload/f_auto,q_auto,w_480,c_limit/c_fill,g_auto/v1720000000/fish/gwangeo.jpg?version=2#photo',
    );
  });

  it('자체 transform을 중복하지 않고 요청 폭으로 교체한다', () => {
    const once = cloudinaryImageUrl(original, 320);
    expect(cloudinaryImageUrl(once, 768)).toContain(
      '/upload/f_auto,q_auto,w_768,c_limit/c_fill,g_auto/',
    );
    expect(cloudinaryImageUrl(once, 768)).not.toContain('w_320,c_limit/f_auto');
  });

  it('320/480/768/960 srcSet을 오름차순으로 제공한다', () => {
    const srcSet = cloudinarySrcSet(original);

    expect(CLOUDINARY_RESPONSIVE_WIDTHS).toEqual([320, 480, 768, 960]);
    expect(srcSet?.split(', ')).toHaveLength(4);
    CLOUDINARY_RESPONSIVE_WIDTHS.forEach((width) => {
      expect(srcSet).toContain(`w_${width},c_limit/`);
      expect(srcSet).toContain(`${width}w`);
    });
  });

  it('Cloudinary로 위장한 host와 일반 URL은 byte-for-byte 보존한다', () => {
    const urls = [
      'https://images.example.com/original.jpg?width=full#fish',
      'https://res.cloudinary.com.evil.example/fish/image/upload/photo.jpg',
      '/local/fish.jpg?raw=true',
      'not a URL',
    ];

    urls.forEach((url) => {
      expect(isCloudinaryImageUrl(url)).toBe(false);
      expect(cloudinaryImageUrl(url, 320)).toBe(url);
      expect(optimizedImageUrl(url, 320)).toBe(url);
      expect(cloudinarySrcSet(url)).toBeUndefined();
    });
  });

  it('기존 optimizedImageUrl 호출 계약을 유지한다', () => {
    expect(optimizedImageUrl(original, 480)).toBe(cloudinaryImageUrl(original, 480));
  });
});
