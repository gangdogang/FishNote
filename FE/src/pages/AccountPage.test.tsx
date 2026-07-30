import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuth } from '../hooks/useAuth';
import AccountPage from './AccountPage';
import { BOOKMARK_STORAGE_KEY } from '../lib/bookmarkStorage';

vi.mock('../hooks/useAuth', () => ({ useAuth: vi.fn() }));
vi.mock('../hooks/usePageMeta', () => ({ usePageMeta: vi.fn() }));

const mockedUseAuth = vi.mocked(useAuth);

interface RenderAccountOptions {
  hasPassword?: boolean;
  isPending?: boolean;
  deleteAccount?: ReturnType<typeof vi.fn>;
}

function renderAccount({
  hasPassword = true,
  isPending = false,
  deleteAccount = vi.fn().mockResolvedValue(undefined),
}: RenderAccountOptions = {}) {
  mockedUseAuth.mockReturnValue({
    accessToken: 'access-token',
    user: {
      id: 1,
      email: 'fish@example.com',
      nickname: '회러버',
      hasPassword,
    },
    isAuthLoading: false,
    deleteAccount,
    deleteAccountMutation: { isPending },
  } as unknown as ReturnType<typeof useAuth>);

  return {
    deleteAccount,
    ...render(
      <MemoryRouter
        initialEntries={['/account']}
      >
        <AccountPage />
      </MemoryRouter>,
    ),
  };
}

describe('AccountPage 회원 탈퇴 폼 접근성', () => {
  beforeEach(() => {
    mockedUseAuth.mockReset();
    window.localStorage.clear();
  });

  it('로그인 전 로컬 저장이 남아 있으면 병합 재진입점을 제공한다', async () => {
    const user = userEvent.setup();
    window.localStorage.setItem(BOOKMARK_STORAGE_KEY, JSON.stringify([2, 7]));
    const requestListener = vi.fn();
    window.addEventListener('fishnote:bookmarkMergeRequested', requestListener);
    renderAccount();

    expect(screen.getByText('로그인 전에 저장한 횟감 2종이 남아 있어요.', { exact: false })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '내 도감으로 옮기기' }));
    expect(requestListener).toHaveBeenCalledOnce();
    window.removeEventListener('fishnote:bookmarkMergeRequested', requestListener);
  });

  it('모든 입력을 안정적인 id/name과 실제 label로 연결하고 helper를 설명으로 제공한다', () => {
    const { container } = renderAccount();
    const password = screen.getByLabelText('현재 비밀번호');
    const confirmation = screen.getByLabelText('확인을 위해 ‘탈퇴합니다’를 입력해 주세요');

    expect(password).toHaveAttribute('id', 'delete-password');
    expect(password).toHaveAttribute('name', 'currentPassword');
    expect(confirmation).toHaveAttribute('id', 'delete-confirmation');
    expect(confirmation).toHaveAttribute('name', 'accountDeletionConfirmation');
    expect(container.querySelector('label[for="delete-password"]')).toHaveTextContent('현재 비밀번호');
    expect(container.querySelector('label[for="delete-confirmation"]')).toHaveTextContent('탈퇴합니다');

    expect(password).toHaveAttribute('aria-invalid', 'false');
    expect(password).toHaveAttribute('aria-describedby', 'delete-password-helper');
    expect(document.getElementById('delete-password-helper')).toHaveTextContent('현재 비밀번호가 필요해요');
    expect(confirmation).toHaveAttribute('aria-invalid', 'false');
    expect(confirmation).toHaveAttribute('aria-describedby', 'delete-confirmation-helper');
    expect(document.getElementById('delete-confirmation-helper')).toHaveTextContent('띄어쓰기 없이 정확히');
  });

  it('keyboard 제출에서도 필드 오류를 알리고 DOM 순서의 첫 오류 입력으로 focus를 옮긴다', async () => {
    const user = userEvent.setup();
    const { deleteAccount } = renderAccount();
    const password = screen.getByLabelText('현재 비밀번호');
    const confirmation = screen.getByLabelText('확인을 위해 ‘탈퇴합니다’를 입력해 주세요');
    const submit = screen.getByRole('button', { name: '계정 삭제' });

    expect(submit).toBeEnabled();
    await user.click(confirmation);
    await user.keyboard('{Enter}');

    expect(deleteAccount).not.toHaveBeenCalled();
    expect(password).toHaveFocus();
    expect(password).toHaveAttribute('aria-invalid', 'true');
    expect(password.getAttribute('aria-describedby')?.split(/\s+/)).toEqual([
      'delete-password-helper',
      'delete-password-error',
    ]);
    expect(document.getElementById('delete-password-error')).toHaveAttribute('role', 'alert');
    expect(confirmation).toHaveAttribute('aria-invalid', 'true');
    expect(document.getElementById('delete-confirmation-error')).toHaveAttribute('role', 'alert');

    await user.type(password, 'current-secret');
    await user.click(submit);

    expect(confirmation).toHaveFocus();
    expect(password).toHaveAttribute('aria-invalid', 'false');
    expect(confirmation).toHaveAttribute('aria-invalid', 'true');
  });

  it('유효한 값은 계정 삭제 요청에 전달하고 소셜 계정은 비밀번호 필드를 요구하지 않는다', async () => {
    const user = userEvent.setup();
    const deleteAccount = vi.fn().mockResolvedValue(undefined);
    renderAccount({ hasPassword: false, deleteAccount });
    const confirmation = screen.getByLabelText('확인을 위해 ‘탈퇴합니다’를 입력해 주세요');

    expect(screen.queryByLabelText('현재 비밀번호')).not.toBeInTheDocument();
    await user.type(confirmation, '탈퇴합니다');
    await user.click(screen.getByRole('button', { name: '계정 삭제' }));

    await waitFor(() => expect(deleteAccount).toHaveBeenCalledWith({ password: undefined }));
  });

  it('서버 오류를 별도 alert로 노출하고 입력을 바꾸면 오래된 오류를 지운다', async () => {
    const user = userEvent.setup();
    const deleteAccount = vi.fn().mockRejectedValue(new Error('계정을 삭제하지 못했어요.'));
    renderAccount({ deleteAccount });
    const password = screen.getByLabelText('현재 비밀번호');
    const confirmation = screen.getByLabelText('확인을 위해 ‘탈퇴합니다’를 입력해 주세요');

    await user.type(password, 'current-secret');
    await user.type(confirmation, '탈퇴합니다');
    await user.click(screen.getByRole('button', { name: '계정 삭제' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('계정을 삭제하지 못했어요.');
    expect(password).toHaveAttribute('aria-invalid', 'false');
    expect(confirmation).toHaveAttribute('aria-invalid', 'false');

    await user.type(confirmation, 'x');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
