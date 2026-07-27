import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import type { FishDetail, FishMedia } from '../types/fish';
import FishMediaGallery from './FishMediaGallery';

const primaryMedia: FishMedia = {
  id: 'primary',
  url: 'https://images.example.com/primary.jpg',
  width: 1200,
  height: 800,
  alt: '방어 대표 사진',
  role: 'PRIMARY',
  credit: '대표 촬영자',
  license: 'CC BY 4.0',
  sourceUrl: 'https://source.example.com/primary',
};

const secondaryMedia: FishMedia = {
  id: 'secondary',
  url: 'https://images.example.com/secondary.jpg',
  width: 1000,
  height: 750,
  alt: '방어 보조 사진',
  role: 'GALLERY',
  credit: '보조 촬영자',
  license: 'All rights reserved',
  sourceUrl: 'javascript:alert(1)',
};

const fish: FishDetail = {
  id: 7,
  name: '방어',
  nameEn: 'Yellowtail',
  media: secondaryMedia,
  galleryMedia: [primaryMedia],
  imageUrl: 'https://legacy.example.com/cover.jpg',
  images: ['https://legacy.example.com/gallery.jpg'],
  description: '겨울철 대표 횟감',
  tasteDesc: '기름지고 고소해요',
  priceLevel: 2,
  tasteTags: ['기름진'],
  seasonMonths: [12, 1, 2],
  featured: true,
  avgRating: 4.8,
  reviewCount: 31,
  ratingDistribution: { '1': 0, '2': 1, '3': 2, '4': 8, '5': 20 },
  tips: [],
  similarFishes: [],
};

describe('FishMediaGallery', () => {
  it('modern PRIMARY media를 legacy보다 우선하고 대표 한 장만 high, 썸네일은 lazy로 요청한다', () => {
    const { container } = render(<FishMediaGallery fish={fish} />);
    expect(screen.getByRole('group', { name: '방어 사진 갤러리' })).toBeInTheDocument();
    const primary = screen.getByRole('img', { name: primaryMedia.alt });
    const selectionGroup = screen.getByRole('group', { name: '사진 선택' });
    const thumbnails = Array.from(selectionGroup.querySelectorAll('img'));

    expect(primary).toHaveAttribute('src', primaryMedia.url);
    expect(primary).toHaveAttribute('loading', 'eager');
    expect(primary).toHaveAttribute('fetchpriority', 'high');
    expect(container.querySelectorAll('img[fetchpriority="high"]')).toHaveLength(1);
    expect(thumbnails).toHaveLength(2);
    thumbnails.forEach((thumbnail) => {
      expect(thumbnail).toHaveAttribute('loading', 'lazy');
      expect(thumbnail).toHaveAttribute('fetchpriority', 'auto');
    });
    expect(container.querySelector('img[src*="legacy.example.com"]')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '방어 이미지 1' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('동일 어종의 이미지 목록이 바뀌면 유효한 첫 사진으로 선택과 priority를 복구한다', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<FishMediaGallery fish={fish} />);
    await user.click(screen.getByRole('button', { name: '방어 이미지 2' }));

    rerender(<FishMediaGallery fish={{ ...fish, media: null, galleryMedia: [primaryMedia] }} />);

    expect(screen.getByRole('button', { name: '방어 이미지 1' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('img', { name: primaryMedia.alt })).toHaveAttribute('loading', 'eager');
    expect(screen.getByRole('img', { name: primaryMedia.alt })).toHaveAttribute('fetchpriority', 'high');

    const extras = [1, 2, 3].map((index) => ({
      ...secondaryMedia,
      id: `extra-${index}`,
      url: `https://images.example.com/extra-${index}.jpg`,
      alt: `방어 추가 사진 ${index}`,
    }));
    rerender(
      <FishMediaGallery
        fish={{ ...fish, media: null, galleryMedia: [primaryMedia, ...extras, secondaryMedia] }}
      />,
    );

    expect(screen.getAllByRole('button', { name: /방어 이미지/ })).toHaveLength(4);
    expect(screen.getByRole('button', { name: '방어 이미지 1' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('img', { name: primaryMedia.alt })).toHaveAttribute('fetchpriority', 'high');
  });

  it('선택한 사진에 맞춰 attribution을 바꾸고 안전하지 않은 source URL은 링크로 만들지 않는다', async () => {
    const user = userEvent.setup();
    render(<FishMediaGallery fish={fish} />);

    let attribution = screen.getByLabelText('사진 정보');
    expect(attribution).toHaveTextContent('사진: 대표 촬영자');
    expect(attribution).toHaveTextContent('라이선스: CC BY 4.0');
    expect(within(attribution).getByRole('link', { name: '원문 보기' })).toHaveAttribute(
      'href',
      primaryMedia.sourceUrl,
    );

    await user.click(screen.getByRole('button', { name: '방어 이미지 2' }));

    expect(screen.getByRole('img', { name: secondaryMedia.alt })).toHaveAttribute('loading', 'lazy');
    expect(screen.getByRole('button', { name: '방어 이미지 2' })).toHaveAttribute('aria-pressed', 'true');
    attribution = screen.getByLabelText('사진 정보');
    expect(attribution).toHaveTextContent('사진: 보조 촬영자');
    expect(attribution).toHaveTextContent('라이선스: All rights reserved');
    expect(within(attribution).queryByRole('link', { name: '원문 보기' })).not.toBeInTheDocument();
  });

  it('modern media가 없으면 legacy images, 이어서 imageUrl을 fallback으로 사용한다', () => {
    const legacyFish = {
      ...fish,
      media: null,
      galleryMedia: [],
      images: ['https://legacy.example.com/one.jpg'],
      imageUrl: 'https://legacy.example.com/cover.jpg',
    };
    const { unmount } = render(<FishMediaGallery fish={legacyFish} />);

    expect(screen.getByRole('img', { name: '방어 사진' })).toHaveAttribute(
      'src',
      'https://legacy.example.com/one.jpg',
    );
    expect(screen.getByRole('img', { name: '방어 사진' })).toHaveAttribute('fetchpriority', 'high');
    unmount();

    render(<FishMediaGallery fish={{ ...legacyFish, images: [] }} />);
    expect(screen.getByRole('img', { name: '방어 사진' })).toHaveAttribute(
      'src',
      'https://legacy.example.com/cover.jpg',
    );
  });

  it('대표 이미지 오류 시 broken image 대신 접근 가능한 placeholder를 표시한다', () => {
    const { container } = render(<FishMediaGallery fish={fish} />);
    const mainFrame = container.firstElementChild?.firstElementChild;

    fireEvent.error(screen.getByRole('img', { name: primaryMedia.alt }));

    const placeholder = screen.getByRole('img', { name: '방어 이미지 준비 중' });
    expect(placeholder).toHaveAttribute('data-image-state', 'error');
    expect(mainFrame?.querySelector('img')).not.toBeInTheDocument();
    expect(screen.queryByRole('img', { name: primaryMedia.alt })).not.toBeInTheDocument();
    expect(screen.getByText('사진 준비 중')).toBeVisible();
    expect(mainFrame).toHaveClass('h-36');
  });

  it('사진이 전혀 없으면 큰 4:3 빈 영역 대신 작은 도감 placeholder와 준비 중 문구를 표시한다', () => {
    const { container } = render(
      <FishMediaGallery
        fish={{ ...fish, media: null, galleryMedia: [], imageUrl: null, images: [] }}
      />,
    );

    const mainFrame = container.firstElementChild?.firstElementChild;
    expect(screen.getByRole('img', { name: '방어 이미지 준비 중' })).toBeInTheDocument();
    expect(screen.getByText('사진 준비 중')).toBeVisible();
    expect(mainFrame).toHaveClass('h-36');
    expect(mainFrame).not.toHaveClass('aspect-[4/3]');
  });
});
