import { FormEvent, useState, type ReactNode } from 'react';
import { Fish } from 'lucide-react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Field } from '../components/FormField';
import { inputClass } from '../lib/uiClasses';
import { useAuth } from '../hooks/useAuth';
import { getAuthRedirectPath, getAuthSwitchState } from '../lib/authRedirect';
import { getErrorMessage } from '../lib/errors';
import { usePageMeta } from '../hooks/usePageMeta';

interface SignupFormState {
  email: string;
  nickname: string;
  password: string;
}

type SignupFieldErrors = Partial<Record<keyof SignupFormState, string>>;

const emptyForm: SignupFormState = {
  email: '',
  nickname: '',
  password: '',
};

export default function SignupPage() {
  usePageMeta('회원가입');
  const [form, setForm] = useState<SignupFormState>(emptyForm);
  const [fieldErrors, setFieldErrors] = useState<SignupFieldErrors>({});
  const [formError, setFormError] = useState('');
  const location = useLocation();
  const navigate = useNavigate();
  const { accessToken, isAuthenticated, isAuthLoading, signup, signupMutation } = useAuth();
  const redirectPath = getAuthRedirectPath(location.state);
  const switchState = getAuthSwitchState(redirectPath);
  const submitting = signupMutation.isPending;

  if (isAuthenticated) return <Navigate to="/" replace />;

  function updateField<FieldName extends keyof SignupFormState>(field: FieldName, value: SignupFormState[FieldName]) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setFieldErrors((prev) => ({ ...prev, [field]: undefined }));
    setFormError('');
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    const nextErrors = validateSignupForm(form);
    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors(nextErrors);
      setFormError('');
      return;
    }

    try {
      await signup({
        email: form.email.trim(),
        nickname: form.nickname.trim(),
        password: form.password,
      });
      navigate(redirectPath, { replace: true });
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
      <h1 className="mb-2 mt-0 text-24 font-extrabold leading-tight text-ink">내 도감을 만들어보세요</h1>
      <p className="mb-6 mt-0 text-14 leading-[1.6] text-ink-mute">저장한 생선과 후기를 어느 기기에서든</p>

      {formError ? <p className="mb-3 mt-0 text-13 font-medium leading-snug text-red-700 dark:text-red-400">{formError}</p> : null}

      <form onSubmit={handleSubmit} noValidate className="grid gap-3">
        <Field label="이메일" htmlFor="signup-email" error={fieldErrors.email}>
          <input
            id="signup-email"
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

        <Field label="닉네임" htmlFor="signup-nickname" error={fieldErrors.nickname}>
          <input
            id="signup-nickname"
            type="text"
            autoComplete="nickname"
            maxLength={30}
            value={form.nickname}
            disabled={submitting}
            placeholder="예: 회러버"
            aria-invalid={Boolean(fieldErrors.nickname)}
            onChange={(event) => updateField('nickname', event.target.value)}
            className={inputClass(Boolean(fieldErrors.nickname))}
          />
        </Field>

        <Field label="비밀번호" htmlFor="signup-password" error={fieldErrors.password} helper="8자 이상이면 돼요">
          <input
            id="signup-password"
            type="password"
            autoComplete="new-password"
            minLength={8}
            maxLength={64}
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
          {submitting ? '확인 중...' : '가입하기'}
        </button>
      </form>

      <p className="mb-0 mt-3 text-center text-[12px] leading-[1.6] text-ink-mute">
        가입하면 FishNote의{' '}
        <Link to="/terms" className="font-semibold text-sea underline-offset-2 hover:underline">이용약관</Link>과{' '}
        <Link to="/privacy" className="font-semibold text-sea underline-offset-2 hover:underline">개인정보처리방침</Link>을 확인한 것으로 봅니다.
      </p>

      <p className="mb-0 mt-5 text-center text-13 font-medium text-ink-mute">
        이미 계정이 있어요?{' '}
        <Link to="/login" state={switchState} className="font-bold text-sea transition hover:text-sea-deep">
          로그인
        </Link>
      </p>
    </AuthPageShell>
  );
}

function AuthPageShell({ children }: { children: ReactNode }) {
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

function validateSignupForm(form: SignupFormState) {
  const errors: SignupFieldErrors = {};
  const email = form.email.trim();
  const nickname = form.nickname.trim();

  if (!email) errors.email = '이메일을 입력해 주세요.';
  else if (!isEmailLike(email)) errors.email = '이메일 형식으로 입력해 주세요.';
  if (!nickname) errors.nickname = '닉네임을 입력해 주세요.';
  else if (nickname.length > 30) errors.nickname = '닉네임은 30자 이하로 입력해 주세요.';
  if (form.password.length < 8) errors.password = '비밀번호는 8자 이상으로 입력해 주세요.';
  else if (form.password.length > 64) errors.password = '비밀번호는 64자 이하로 입력해 주세요.';

  return errors;
}

function isEmailLike(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}
