import { FormEvent, useState } from 'react';
import { isAxiosError } from 'axios';
import { Fish } from 'lucide-react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Field, inputClass } from '../components/FormField';
import { useAuth } from '../hooks/useAuth';
import { getAuthRedirectPath, getAuthSwitchState } from '../lib/authRedirect';
import { getErrorMessage } from '../lib/errors';

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
  const [form, setForm] = useState<LoginFormState>(emptyForm);
  const [fieldErrors, setFieldErrors] = useState<LoginFieldErrors>({});
  const [formError, setFormError] = useState('');
  const location = useLocation();
  const navigate = useNavigate();
  const { accessToken, isAuthenticated, isAuthLoading, login, loginMutation } = useAuth();
  const redirectPath = getAuthRedirectPath(location.state);
  const switchState = getAuthSwitchState(redirectPath);
  const submitting = loginMutation.isPending;

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

  if (accessToken && isAuthLoading) {
    return (
      <AuthPageShell>
        <p className="m-0 text-center text-[14px] font-medium text-ink-mute">확인 중...</p>
      </AuthPageShell>
    );
  }

  return (
    <AuthPageShell>
      <AuthBrand />
      <h1 className="mb-6 mt-0 text-[24px] font-extrabold leading-tight text-ink">다시 오셨네요</h1>

      {formError ? <p className="mb-3 mt-0 text-[13px] font-medium leading-snug text-red-700">{formError}</p> : null}

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
          className="mt-1 inline-flex min-h-11 w-full items-center justify-center rounded-[10px] border-0 bg-sea px-5 py-2.5 text-sm font-bold text-white transition hover:bg-sea disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {submitting ? '확인 중...' : '로그인'}
        </button>
      </form>

      <p className="mb-0 mt-5 text-center text-[13px] font-medium text-ink-mute">
        처음이세요?{' '}
        <Link to="/signup" state={switchState} className="font-bold text-sea transition hover:text-sea">
          회원가입
        </Link>
      </p>
    </AuthPageShell>
  );
}

function AuthPageShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex max-w-[980px] justify-center px-4 pb-20 pt-12 sm:px-7 sm:pt-16">
      <section className="w-full max-w-[400px] rounded-card border border-line bg-white px-5 py-6 sm:px-6 sm:py-7">
        {children}
      </section>
    </main>
  );
}

function AuthBrand() {
  return (
    <div className="mb-5 flex items-center gap-2 text-ink" aria-label="FishNote">
      <Fish className="h-4 w-[26px] flex-none text-sea" aria-hidden />
      <span className="text-[17px] font-extrabold leading-none">FishNote</span>
    </div>
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
