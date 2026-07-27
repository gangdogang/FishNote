import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import SmartImage from '../components/SmartImage';
import type { FishMedia } from '../types/fish';

const media: FishMedia = {
  id: 'primary-gwangeo',
  url: 'https://res.cloudinary.com/fish-note/image/upload/v1/gwangeo.jpg',
  width: 1200,
  height: 800,
  alt: '접시에 담긴 광어회',
  role: 'PRIMARY',
  credit: '촬영자',
  license: 'CC BY 4.0',
  blurDataUrl: 'data:image/png;base64,aGVsbG8=',
  focalPoint: { x: 0.25, y: 0.75 },
};

describe('SmartImage', () => {
  it('media dimensions, aspect ratio, Cloudinary srcSet, sizes, focal point를 적용한다', () => {
    const { container } = render(
      <SmartImage
        media={media}
        legacyUrl="https://legacy.example/gwangeo.jpg"
        fallbackName="광어"
        sizes="(min-width: 768px) 320px, 50vw"
      />,
    );

    const image = screen.getByRole('img', { name: '접시에 담긴 광어회' });
    const wrapper = container.firstElementChild;

    expect(wrapper).toHaveStyle({ aspectRatio: '1200 / 800' });
    expect(image).toHaveAttribute('width', '1200');
    expect(image).toHaveAttribute('height', '800');
    expect(image).toHaveAttribute('sizes', '(min-width: 768px) 320px, 50vw');
    expect(image).toHaveAttribute(
      'src',
      'https://res.cloudinary.com/fish-note/image/upload/f_auto,q_auto,w_960,c_limit/v1/gwangeo.jpg',
    );
    expect(image.getAttribute('srcset')?.split(', ')).toHaveLength(4);
    expect(image.getAttribute('srcset')).toContain('w_320,c_limit/v1/gwangeo.jpg 320w');
    expect(image.getAttribute('srcset')).toContain('w_960,c_limit/v1/gwangeo.jpg 960w');
    expect(image).toHaveStyle({ objectPosition: '25% 75%' });
    expect(wrapper).toHaveStyle({ backgroundImage: `url(${media.blurDataUrl})` });
  });

  it('기본은 lazy/async이고 priority 이미지만 eager/high로 요청한다', () => {
    const { rerender } = render(
      <SmartImage media={media} fallbackName="광어" sizes="100vw" />,
    );
    let image = screen.getByRole('img');

    expect(image).toHaveAttribute('loading', 'lazy');
    expect(image).toHaveAttribute('fetchpriority', 'auto');
    expect(image).toHaveAttribute('decoding', 'async');

    rerender(<SmartImage media={media} fallbackName="광어" sizes="100vw" priority />);
    image = screen.getByRole('img');
    expect(image).toHaveAttribute('loading', 'eager');
    expect(image).toHaveAttribute('fetchpriority', 'high');
  });

  it('decorative 이미지는 빈 alt와 aria-hidden을 사용한다', () => {
    const { container } = render(
      <SmartImage media={media} fallbackName="광어" sizes="100vw" decorative />,
    );

    const image = container.querySelector('img');
    expect(image).toHaveAttribute('alt', '');
    expect(image).toHaveAttribute('aria-hidden', 'true');
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('media가 없으면 legacy URL을 그대로 사용하고 fallback dimensions를 예약한다', () => {
    const legacyUrl = 'https://images.example.com/fish.jpg?quality=original#primary';
    const { container } = render(
      <SmartImage legacyUrl={legacyUrl} fallbackName="도미" sizes="100vw" />,
    );
    const image = screen.getByRole('img', { name: '도미 사진' });

    expect(image).toHaveAttribute('src', legacyUrl);
    expect(image).not.toHaveAttribute('srcset');
    expect(image).toHaveAttribute('width', '960');
    expect(image).toHaveAttribute('height', '720');
    expect(container.firstElementChild).toHaveStyle({ aspectRatio: '960 / 720' });
  });

  it('URL이 없으면 accessible placeholder를 표시한다', () => {
    const { container } = render(
      <SmartImage media={null} legacyUrl={null} fallbackName="연어" sizes="100vw" />,
    );

    expect(container.querySelector('img')).not.toBeInTheDocument();
    expect(screen.getByRole('img', { name: '연어 이미지 준비 중' })).toBeInTheDocument();
    expect(container.firstElementChild).toHaveAttribute('data-image-state', 'missing');
  });

  it('load error가 나면 broken image element를 제거하고 placeholder로 전환한다', () => {
    const { container } = render(
      <SmartImage media={media} fallbackName="광어" sizes="100vw" />,
    );

    fireEvent.error(screen.getByRole('img', { name: media.alt }));

    expect(container.querySelector('img')).not.toBeInTheDocument();
    expect(screen.getByRole('img', { name: '광어 이미지 준비 중' })).toBeInTheDocument();
    expect(container.firstElementChild).toHaveAttribute('data-image-state', 'error');
  });

  it('새 media source가 전달되면 이전 source 오류 상태를 이어받지 않는다', () => {
    const { rerender } = render(
      <SmartImage media={media} fallbackName="광어" sizes="100vw" />,
    );
    fireEvent.error(screen.getByRole('img', { name: media.alt }));

    const replacement: FishMedia = {
      ...media,
      id: 'replacement',
      url: 'https://images.example.com/replacement.jpg',
      alt: '교체한 광어 사진',
    };
    rerender(<SmartImage media={replacement} fallbackName="광어" sizes="100vw" />);

    expect(screen.getByRole('img', { name: replacement.alt })).toHaveAttribute(
      'src',
      replacement.url,
    );
  });
});
