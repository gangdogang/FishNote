import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import LoginPage from './LoginPage';
import SignupPage from './SignupPage';

const { useAuthMock } = vi.hoisted(() => ({ useAuthMock: vi.fn() }));

vi.mock('../hooks/useAuth', () => ({ useAuth: useAuthMock }));

const login = vi.fn();
const signup = vi.fn();

function setAuthState(isPending = false) {
  useAuthMock.mockReturnValue({
    accessToken: null,
    isAuthenticated: false,
    isAuthLoading: false,
    login,
    signup,
    loginMutation: { isPending },
    signupMutation: { isPending },
  });
}

function renderAuthPage(page: React.ReactNode, initialEntry: string) {
  return render(
    <MemoryRouter
      initialEntries={[initialEntry]}
    >
      {page}
    </MemoryRouter>,
  );
}

function getDescriptionElements(control: HTMLElement) {
  const descriptionIds = control.getAttribute('aria-describedby')?.split(/\s+/).filter(Boolean) ?? [];
  return descriptionIds.map((id) => document.getElementById(id));
}

beforeEach(() => {
  login.mockReset();
  signup.mockReset();
  setAuthState();
});

describe('authentication form accessibility', () => {
  it('로그인 입력에 label·id·name을 연결하고 첫 검증 오류로 focus한다', async () => {
    const user = userEvent.setup();
    const { container } = renderAuthPage(<LoginPage />, '/login');
    const email = screen.getByLabelText('이메일');
    const password = screen.getByLabelText('비밀번호');
    const submit = screen.getByRole('button', { name: '로그인' });

    expect(email).toHaveAttribute('id', 'login-email');
    expect(email).toHaveAttribute('name', 'email');
    expect(password).toHaveAttribute('id', 'login-password');
    expect(password).toHaveAttribute('name', 'password');
    expect(new Set([email.id, password.id])).toHaveProperty('size', 2);
    expect(container.querySelector(`label[for="${email.id}"]`)).toHaveTextContent('이메일');
    expect(container.querySelector(`label[for="${password.id}"]`)).toHaveTextContent('비밀번호');
    expect(email).toHaveClass('focus-visible:ring-2', 'focus-visible:ring-focus');
    expect(submit).toHaveClass('focus-visible:ring-2', 'focus-visible:ring-focus');

    await user.click(submit);

    expect(email).toHaveFocus();
    expect(email).toHaveAttribute('aria-invalid', 'true');
    const [emailError] = getDescriptionElements(email);
    expect(emailError).toHaveAttribute('role', 'alert');
    expect(emailError).toHaveTextContent('이메일을 입력해 주세요.');

    await user.type(email, 'fish@example.com');
    await user.click(submit);

    expect(password).toHaveFocus();
    expect(password).toHaveAttribute('aria-invalid', 'true');
    const [passwordError] = getDescriptionElements(password);
    expect(passwordError).toHaveAttribute('role', 'alert');
    expect(passwordError).toHaveTextContent('비밀번호를 입력해 주세요.');
  });

  it('회원가입 helper와 오류를 aria-describedby에 함께 연결하고 순서대로 focus한다', async () => {
    const user = userEvent.setup();
    renderAuthPage(<SignupPage />, '/signup');
    const email = screen.getByLabelText('이메일');
    const nickname = screen.getByLabelText('닉네임');
    const password = screen.getByLabelText('비밀번호');
    const submit = screen.getByRole('button', { name: '가입하기' });

    expect([email, nickname, password].map((control) => control.id)).toEqual([
      'signup-email',
      'signup-nickname',
      'signup-password',
    ]);
    expect([email, nickname, password].map((control) => control.getAttribute('name'))).toEqual([
      'email',
      'nickname',
      'password',
    ]);
    expect(getDescriptionElements(password)).toHaveLength(1);
    expect(getDescriptionElements(password)[0]).toHaveTextContent('8자 이상이면 돼요');

    await user.click(submit);

    expect(email).toHaveFocus();
    expect(email).toHaveAttribute('aria-invalid', 'true');
    const passwordDescriptions = getDescriptionElements(password);
    expect(passwordDescriptions).toHaveLength(2);
    expect(passwordDescriptions.map((element) => element?.textContent)).toEqual([
      '8자 이상이면 돼요',
      '비밀번호는 8자 이상으로 입력해 주세요.',
    ]);
    expect(passwordDescriptions[1]).toHaveAttribute('role', 'alert');

    await user.type(email, 'fish@example.com');
    await user.type(nickname, '회러버');
    await user.click(submit);

    expect(password).toHaveFocus();
  });

  it('로그인과 회원가입 서버 오류를 폼 전역 alert로 알린다', async () => {
    const user = userEvent.setup();
    login.mockRejectedValueOnce(new Error('로그인 요청을 처리하지 못했습니다.'));
    const loginView = renderAuthPage(<LoginPage />, '/login');

    await user.type(screen.getByLabelText('이메일'), 'fish@example.com');
    await user.type(screen.getByLabelText('비밀번호'), 'password123');
    await user.click(screen.getByRole('button', { name: '로그인' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('로그인 요청을 처리하지 못했습니다.');
    loginView.unmount();

    signup.mockRejectedValueOnce(new Error('회원가입 요청을 처리하지 못했습니다.'));
    renderAuthPage(<SignupPage />, '/signup');
    await user.type(screen.getByLabelText('이메일'), 'fish@example.com');
    await user.type(screen.getByLabelText('닉네임'), '회러버');
    await user.type(screen.getByLabelText('비밀번호'), 'password123');
    await user.click(screen.getByRole('button', { name: '가입하기' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('회원가입 요청을 처리하지 못했습니다.');
  });

  it('제출 중에는 입력과 제출 버튼을 disabled 상태로 유지한다', () => {
    setAuthState(true);
    const loginView = renderAuthPage(<LoginPage />, '/login');

    expect(screen.getByLabelText('이메일')).toBeDisabled();
    expect(screen.getByLabelText('비밀번호')).toBeDisabled();
    expect(screen.getByRole('button', { name: '확인 중...' })).toBeDisabled();
    loginView.unmount();

    renderAuthPage(<SignupPage />, '/signup');
    expect(screen.getByLabelText('이메일')).toBeDisabled();
    expect(screen.getByLabelText('닉네임')).toBeDisabled();
    expect(screen.getByLabelText('비밀번호')).toBeDisabled();
    expect(screen.getByRole('button', { name: '확인 중...' })).toBeDisabled();
  });
});
