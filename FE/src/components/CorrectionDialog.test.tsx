import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { FishCorrectionRequest } from '../types/source';
import CorrectionDialog from './CorrectionDialog';

interface DialogOverrides {
  submitting?: boolean;
  serverError?: string;
  onClearError?: () => void;
  onSubmit?: (request: FishCorrectionRequest) => Promise<void>;
  onClose?: () => void;
}

function renderDialog(overrides: DialogOverrides = {}) {
  const props = {
    open: true,
    fishName: '도다리',
    initialClaimType: 'SEASON' as const,
    submitting: false,
    onClearError: vi.fn(),
    onSubmit: vi.fn(async () => undefined),
    onClose: vi.fn(),
    ...overrides,
  };

  return { ...render(<CorrectionDialog {...props} />), props };
}

afterEach(() => {
  document.body.style.overflow = '';
});

describe('CorrectionDialog', () => {
  it('native dialog에 설명을 연결하고 제보 유형에 첫 focus를 두며 PII 입력을 수집하지 않는다', async () => {
    renderDialog();

    const dialog = screen.getByRole('dialog', { name: '도다리 정보 오류 제보' });
    const claimType = screen.getByRole('combobox', { name: '제보할 정보' });
    expect(dialog).toHaveAttribute('open');
    expect(dialog).toHaveAccessibleDescription(
      '개인정보는 받지 않습니다. 확인이 필요한 내용과 공개 원문이 있다면 함께 남겨주세요.',
    );
    await waitFor(() => expect(claimType).toHaveFocus());

    expect(screen.getByLabelText('확인이 필요한 내용')).toHaveAttribute('name', 'message');
    expect(screen.getByLabelText('근거 원문 URL (선택)')).toHaveAttribute('name', 'sourceUrl');
    expect(screen.queryByLabelText(/이름|이메일|연락처/)).not.toBeInTheDocument();
    expect(dialog.querySelector('input[name="name"], input[name="email"], input[name="contact"]'))
      .not.toBeInTheDocument();
  });

  it('공백 제보를 거부하고 오류를 연결한 내용 입력으로 focus한다', async () => {
    const user = userEvent.setup();
    const { props } = renderDialog();

    await user.type(screen.getByLabelText('확인이 필요한 내용'), '   ');
    await user.click(screen.getByRole('button', { name: '제보 접수' }));

    const message = screen.getByLabelText('확인이 필요한 내용');
    expect(await screen.findByText('확인이 필요한 내용을 입력해 주세요.')).toHaveAttribute('role', 'alert');
    await waitFor(() => expect(message).toHaveFocus());
    expect(message).toHaveAttribute('aria-invalid', 'true');
    expect(props.onSubmit).not.toHaveBeenCalled();
  });

  it('http·https 공개 원문이 아닌 URL을 거부하고 URL 입력으로 focus한다', async () => {
    const user = userEvent.setup();
    const { props } = renderDialog();
    await user.type(screen.getByLabelText('확인이 필요한 내용'), '제철 월이 다르게 표시됩니다.');
    fireEvent.change(screen.getByLabelText('근거 원문 URL (선택)'), {
      target: { value: 'javascript:alert(1)' },
    });

    await user.click(screen.getByRole('button', { name: '제보 접수' }));

    const sourceUrl = screen.getByLabelText('근거 원문 URL (선택)');
    expect(await screen.findByText('사용자 정보가 없는 http 또는 https 공개 링크를 입력해 주세요.'))
      .toHaveAttribute('role', 'alert');
    await waitFor(() => expect(sourceUrl).toHaveFocus());
    expect(sourceUrl).toHaveAttribute('aria-invalid', 'true');
    expect(props.onSubmit).not.toHaveBeenCalled();
  });

  it('입력을 정규화해 claim·message·선택 URL만 제출한다', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn(async (request: FishCorrectionRequest) => {
      void request;
    });
    renderDialog({ onSubmit });

    await user.selectOptions(screen.getByRole('combobox', { name: '제보할 정보' }), 'PRICE');
    fireEvent.change(screen.getByLabelText('확인이 필요한 내용'), {
      target: { value: '  가격 단위가 잘못됐습니다.  ' },
    });
    fireEvent.change(screen.getByLabelText('근거 원문 URL (선택)'), {
      target: { value: '  https://example.org/public-source  ' },
    });
    await user.click(screen.getByRole('button', { name: '제보 접수' }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({
      claimType: 'PRICE',
      message: '가격 단위가 잘못됐습니다.',
      sourceUrl: 'https://example.org/public-source',
    }));
    expect(Object.keys(onSubmit.mock.calls[0]?.[0] ?? {})).toEqual([
      'claimType',
      'message',
      'sourceUrl',
    ]);
  });

  it('제출 중에는 모든 입력과 Escape·backdrop·취소 닫기를 잠근다', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderDialog({ submitting: true, onClose });

    const dialog = screen.getByRole('dialog', { name: '도다리 정보 오류 제보' });
    expect(dialog).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByRole('combobox', { name: '제보할 정보' })).toBeDisabled();
    expect(screen.getByLabelText('확인이 필요한 내용')).toBeDisabled();
    expect(screen.getByLabelText('근거 원문 URL (선택)')).toBeDisabled();
    expect(screen.getByRole('button', { name: '접수 중...' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '취소' })).toBeDisabled();

    await user.keyboard('{Escape}');
    fireEvent.click(dialog);
    await user.click(screen.getByRole('button', { name: '취소' }));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('서버 오류를 전역 alert로 알리고 사용자가 다시 입력하면 오류 해제를 위임한다', async () => {
    const user = userEvent.setup();
    const onClearError = vi.fn();
    renderDialog({
      serverError: '제보를 접수하지 못했습니다. 잠시 후 다시 시도해 주세요.',
      onClearError,
    });

    expect(screen.getByRole('alert')).toHaveTextContent(
      '제보를 접수하지 못했습니다. 잠시 후 다시 시도해 주세요.',
    );
    await user.type(screen.getByLabelText('확인이 필요한 내용'), '다시 설명합니다.');
    expect(onClearError).toHaveBeenCalled();
  });
});
