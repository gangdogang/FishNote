import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ComponentProps } from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { uploadImage } from '../api/image';
import { AuthProvider } from '../hooks/useAuth';
import ReviewForm from './ReviewForm';

vi.mock('../api/image', () => ({ uploadImage: vi.fn() }));

beforeEach(() => {
  vi.clearAllMocks();
  Object.defineProperty(URL, 'createObjectURL', {
    configurable: true,
    value: vi.fn(() => 'blob:review-preview'),
  });
  Object.defineProperty(URL, 'revokeObjectURL', {
    configurable: true,
    value: vi.fn(),
  });
});

function renderReviewForm(overrides: Partial<ComponentProps<typeof ReviewForm>> = {}) {
  const props: ComponentProps<typeof ReviewForm> = {
    submitting: false,
    resetKey: 0,
    onSubmit: vi.fn(),
    ...overrides,
  };
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  return {
    ...render(
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <ReviewForm {...props} />
        </AuthProvider>
      </QueryClientProvider>,
    ),
    props,
  };
}

describe('ReviewForm accessibility', () => {
  it('모든 입력을 실제 label과 고유 id로 연결하고 helper를 aria-describedby로 참조한다', () => {
    const { container } = renderReviewForm();

    const nickname = screen.getByLabelText('닉네임');
    const content = screen.getByLabelText('후기');
    const password = screen.getByLabelText('비밀번호');
    const image = screen.getByLabelText('사진 추가');
    const controls = [nickname, content, password, image];
    const ids = controls.map((control) => control.id);

    expect(ids.every(Boolean)).toBe(true);
    expect(new Set(ids).size).toBe(ids.length);
    expect(container.querySelector(`label[for="${nickname.id}"]`)).toHaveTextContent('닉네임');
    expect(container.querySelector(`label[for="${content.id}"]`)).toHaveTextContent('후기');
    expect(container.querySelector(`label[for="${password.id}"]`)).toHaveTextContent('비밀번호');
    expect(container.querySelector(`label[for="${image.id}"]`)).toHaveTextContent('사진 추가');

    const helperId = password.getAttribute('aria-describedby');
    expect(helperId).toBeTruthy();
    expect(document.getElementById(helperId!)).toHaveTextContent('후기를 지울 때만 써요 (4자 이상)');

    expect(image).toHaveAttribute(
      'accept',
      'image/jpeg,image/png,image/gif,image/webp',
    );
    const imageHelperId = image.getAttribute('aria-describedby')?.split(/\s+/)[0];
    expect(document.getElementById(imageHelperId!)).toHaveTextContent(
      'JPG, PNG, 정적 GIF, 정적 WebP · 최대 5MB',
    );
  });

  it('검증 오류를 control과 연결하고 첫 오류 필드로 focus를 옮긴다', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    renderReviewForm({ onSubmit });

    const nickname = screen.getByLabelText('닉네임');
    const content = screen.getByLabelText('후기');
    const password = screen.getByLabelText('비밀번호');

    await user.click(screen.getByRole('button', { name: '등록하기' }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(nickname).toHaveFocus();
    expect(nickname).toHaveAttribute('aria-invalid', 'true');
    const nicknameErrorId = nickname.getAttribute('aria-describedby');
    const nicknameError = document.getElementById(nicknameErrorId!);
    expect(nicknameError).toHaveAttribute('role', 'alert');
    expect(nicknameError).toHaveTextContent('닉네임을 입력해 주세요.');

    const passwordDescriptions = password.getAttribute('aria-describedby')?.split(/\s+/) ?? [];
    expect(passwordDescriptions).toHaveLength(2);
    expect(passwordDescriptions.map((id) => document.getElementById(id)?.textContent)).toEqual([
      '후기를 지울 때만 써요 (4자 이상)',
      '비밀번호는 4~20자로 입력해 주세요.',
    ]);

    await user.type(nickname, '회러버');
    await user.type(password, '1234');
    await user.click(screen.getByRole('button', { name: '등록하기' }));
    expect(content).toHaveFocus();
    expect(content).toHaveAttribute('aria-invalid', 'true');
  });

  it('별점을 fieldset/legend와 완전한 roving radio keyboard 패턴으로 제공한다', async () => {
    const user = userEvent.setup();
    renderReviewForm();

    const group = screen.getByRole('radiogroup', { name: '별점 (선택)' });
    const radios = within(group).getAllByRole('radio');
    expect(group.closest('fieldset')?.querySelector('legend')).toHaveTextContent('별점 (선택)');
    expect(radios).toHaveLength(5);
    expect(radios.map((radio) => radio.tabIndex)).toEqual([0, -1, -1, -1, -1]);

    radios[0].focus();
    await user.keyboard('{ArrowLeft}');
    expect(radios[4]).toHaveFocus();
    expect(radios[4]).toHaveAttribute('aria-checked', 'true');
    expect(radios.map((radio) => radio.tabIndex)).toEqual([-1, -1, -1, -1, 0]);

    await user.keyboard('{ArrowRight}');
    expect(radios[0]).toHaveFocus();
    expect(radios[0]).toHaveAttribute('aria-checked', 'true');

    await user.keyboard('{End}');
    expect(radios[4]).toHaveFocus();
    expect(radios[4]).toHaveAttribute('aria-checked', 'true');

    await user.click(radios[4]);
    expect(radios.every((radio) => radio.getAttribute('aria-checked') === 'false')).toBe(true);
    expect(radios[4]).toHaveAttribute('tabindex', '0');
  });

  it('별점·사진·등록 control의 최소 44px hit area 클래스와 서버 오류 alert를 유지한다', () => {
    renderReviewForm({ error: '후기를 등록하지 못했어요.' });

    screen.getAllByRole('radio').forEach((radio) => {
      expect(radio).toHaveClass('min-h-11', 'min-w-11');
    });
    expect(screen.getByText('사진 추가').closest('label')).toHaveClass('min-h-11');
    expect(screen.getByRole('button', { name: '등록하기' })).toHaveClass('min-h-11');
    expect(screen.getByRole('alert')).toHaveTextContent('후기를 등록하지 못했어요.');
  });

  it('서버가 검증하는 네 가지 이미지 형식 외 파일은 업로드 전에 거절한다', () => {
    renderReviewForm();
    const image = screen.getByLabelText('사진 추가');
    const unsupported = new File(['heic'], 'photo.heic', { type: 'image/heic' });

    fireEvent.change(image, { target: { files: [unsupported] } });

    expect(image).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('alert')).toHaveTextContent(
      'JPG, PNG, 정적 GIF, 정적 WebP 사진만 올릴 수 있어요',
    );
  });

  it('검증된 로컬 사진은 HTML 재해석 없이 이미지 URL 속성으로 미리 본다', async () => {
    const user = userEvent.setup();
    renderReviewForm();

    await user.upload(
      screen.getByLabelText('사진 추가'),
      new File(['jpeg'], 'review.jpg', { type: 'image/jpeg' }),
    );

    expect(screen.getByAltText('선택한 후기 사진 미리보기')).toHaveAttribute(
      'src',
      'blob:review-preview',
    );
  });

  it('업로드 응답의 assetId와 URL을 후기 요청에 함께 전달한다', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    vi.mocked(uploadImage).mockResolvedValue({
      url: 'https://res.cloudinary.com/demo/image/upload/fishnote/reviews/asset.jpg',
      assetId: 'ab4fd622-a3b6-45cc-bf73-b1f2ff45b76d',
      expiresAt: '2026-07-22T13:00:00Z',
    });
    renderReviewForm({ onSubmit });

    await user.type(screen.getByLabelText('닉네임'), '회러버');
    await user.type(screen.getByLabelText('후기'), '추적 이미지 후기');
    await user.type(screen.getByLabelText('비밀번호'), '1234');
    await user.upload(
      screen.getByLabelText('사진 추가'),
      new File(['jpeg'], 'review.jpg', { type: 'image/jpeg' }),
    );
    await user.click(screen.getByRole('button', { name: '등록하기' }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
        imageUrl: 'https://res.cloudinary.com/demo/image/upload/fishnote/reviews/asset.jpg',
        imageAssetId: 'ab4fd622-a3b6-45cc-bf73-b1f2ff45b76d',
      }));
    });
  });
});
