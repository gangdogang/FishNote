import { FormEvent, useState } from 'react';
import { isAxiosError } from 'axios';
import { Fish } from 'lucide-react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Field } from '../components/FormField';
import { inputClass } from '../lib/uiClasses';
import { useAuth } from '../hooks/useAuth';
import { getAuthRedirectPath, getAuthSwitchState } from '../lib/authRedirect';
import { getErrorMessage } from '../lib/errors';
import { usePageMeta } from '../hooks/usePageMeta';
import { isKakaoOAuthConfigured, startKakaoOAuth } from '../lib/kakaoOAuth';

interface LoginFormState {
  email: string;
  password: string;
}

type LoginFieldErrors = Partial<Record<keyof LoginFormState, string>>;

const emptyForm: LoginFormState = {
  email: '',
  password: '',
};

const LOGIN_FAILURE_MESSAGE = '이메일 또는 비밀번호를 확인해 주세요';

export default function LoginPage() {
  usePageMeta('로그인');
  const [form, setForm] = useState<LoginFormState>(emptyForm);
  const [fieldErrors, setFieldErrors] = useState<LoginFieldErrors>({});
  const [formError, setFormError] = useState('');
  const location = useLocation();
  const navigate = useNavigate();
  const { accessToken, isAuthenticated, isAuthLoading, login, loginMutation } = useAuth();
  const redirectPath = getAuthRedirectPath(location.state);
  const switchState = getAuthSwitchState(redirectPath);
  const submitting = loginMutation.isPending;
  const kakaoOAuthConfigured = isKakaoOAuthConfigured();

  if (isAuthenticated) return <Navigate to="/" replace />;

  function updateField<FieldName extends keyof LoginFormState>(field: FieldName, value: LoginFormState[FieldName]) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setFieldErrors((prev) => ({ ...prev, [field]: undefined }));
    setFormError('');
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    const nextErrors = validateLoginForm(form);
    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors(nextErrors);
      setFormError('');
      return;
    }

    try {
      await login({
        email: form.email.trim(),
        password: form.password,
      });
      navigate(redirectPath, { replace: true });
    } catch (error) {
      if (isAxiosError(error) && error.response?.status === 401) {
        setFormError(LOGIN_FAILURE_MESSAGE);
        return;
      }

      setFormError(getErrorMessage(error));
    }
  }

  function handleKakaoLogin() {
    try {
      setFormError('');
      startKakaoOAuth(redirectPath);
    } catch (error) {
      setFormError(getErrorMessage(error));
    }
  }

  if (accessToken && isAuthLoading) {
    return (
      <AuthPageShell>
        <p className="m-0 text-center text-14 font-medium text-ink-mute">확인 중...</p>
      </AuthPageShell>
    );
  }

  return (
    <AuthPageShell>
      <AuthBrand />
      <h1 className="mb-6 mt-0 text-24 font-extrabold leading-tight text-ink">다시 오셨네요</h1>

      {formError ? <p className="mb-3 mt-0 text-13 font-medium leading-snug text-red-700 dark:text-red-400">{formError}</p> : null}

      {kakaoOAuthConfigured ? (
        <>
          <button
            type="button"
            onClick={handleKakaoLogin}
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-btn border-0 bg-[#FEE500] px-5 py-2.5 text-sm font-bold text-[rgba(0,0,0,0.85)] transition hover:bg-[#F4DC00] focus:outline-none focus:ring-2 focus:ring-[#FEE500] focus:ring-offset-2"
          >
            <KakaoLogo />
            카카오로 계속하기
          </button>
          <div className="my-5 flex items-center gap-3 text-12.5 text-ink-mute" aria-hidden>
            <span className="h-px flex-1 bg-line" />
            <span>또는 이메일로</span>
            <span className="h-px flex-1 bg-line" />
          </div>
        </>
      ) : null}

      <form onSubmit={handleSubmit} noValidate className="grid gap-3">
        <Field label="이메일" htmlFor="login-email" error={fieldErrors.email}>
          <input
            id="login-email"
            type="email"
            autoComplete="email"
            value={form.email}
            disabled={submitting}
            placeholder="email@example.com"
            aria-invalid={Boolean(fieldErrors.email)}
            onChange={(event) => updateField('email', event.target.value)}
            className={inputClass(Boolean(fieldErrors.email))}
          />
        </Field>

        <Field label="비밀번호" htmlFor="login-password" error={fieldErrors.password}>
          <input
            id="login-password"
            type="password"
            autoComplete="current-password"
            value={form.password}
            disabled={submitting}
            placeholder="비밀번호"
            aria-invalid={Boolean(fieldErrors.password)}
            onChange={(event) => updateField('password', event.target.value)}
            className={inputClass(Boolean(fieldErrors.password))}
          />
        </Field>

        <button
          type="submit"
          disabled={submitting}
          className="mt-1 inline-flex min-h-11 w-full items-center justify-center rounded-btn border-0 bg-sea px-5 py-2.5 text-sm font-bold text-white transition hover:bg-sea-deep disabled:cursor-not-allowed disabled:bg-slate-300 dark:disabled:bg-slate-600"
        >
          {submitting ? '확인 중...' : '로그인'}
        </button>
      </form>

      {kakaoOAuthConfigured ? (
        <p className="mb-0 mt-3 text-center text-12.5 leading-[1.6] text-ink-mute">
          카카오로 계속하면 FishNote의{' '}
          <Link to="/terms" className="font-semibold text-sea underline-offset-2 hover:underline">이용약관</Link>과{' '}
          <Link to="/privacy" className="font-semibold text-sea underline-offset-2 hover:underline">개인정보처리방침</Link>을 확인한 것으로 봅니다.
        </p>
      ) : null}

      <p className="mb-0 mt-5 text-center text-13 font-medium text-ink-mute">
        처음이세요?{' '}
        <Link to="/signup" state={switchState} className="font-bold text-sea transition hover:text-sea-deep">
          회원가입
        </Link>
      </p>
    </AuthPageShell>
  );
}

function AuthPageShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex max-w-content justify-center px-4 pb-20 pt-12 sm:px-7 sm:pt-16">
      <section className="w-full max-w-[400px] rounded-card border border-line bg-surface px-5 py-6 sm:px-6 sm:py-7">
        {children}
      </section>
    </main>
  );
}

function AuthBrand() {
  return (
    <div className="mb-5 flex items-center gap-2 text-ink" aria-label="FishNote">
      <Fish className="h-4 w-[26px] flex-none text-sea" aria-hidden />
      <span className="text-17 font-extrabold leading-none">FishNote</span>
    </div>
  );
}

function KakaoLogo() {
  return (
    <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" aria-hidden>
      <path
        fill="currentColor"
        d="M12 3.25c-5.11 0-9.25 3.24-9.25 7.23 0 2.55 1.69 4.8 4.24 6.08l-1.08 3.98a.36.36 0 0 0 .54.4l4.72-3.11c.27.02.55.03.83.03 5.11 0 9.25-3.24 9.25-7.38S17.11 3.25 12 3.25Z"
      />
    </svg>
  );
}

function validateLoginForm(form: LoginFormState) {
  const errors: LoginFieldErrors = {};
  const email = form.email.trim();

  if (!email) errors.email = '이메일을 입력해 주세요.';
  else if (!isEmailLike(email)) errors.email = '이메일 형식으로 입력해 주세요.';
  if (!form.password) errors.password = '비밀번호를 입력해 주세요.';

  return errors;
}

function isEmailLike(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}
