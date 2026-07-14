import { FormEvent, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Field } from '../components/FormField';
import { inputClass } from '../lib/uiClasses';
import { useAuth } from '../hooks/useAuth';
import { getErrorMessage } from '../lib/errors';
import { usePageMeta } from '../hooks/usePageMeta';

export default function AccountPage() {
  usePageMeta('계정 관리');
  const location = useLocation();
  const navigate = useNavigate();
  const { accessToken, user, isAuthLoading, deleteAccount, deleteAccountMutation } = useAuth();
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState('');
  const requiresPassword = Boolean(user?.hasPassword);

  if (!accessToken) return <Navigate to="/login" replace state={{ from: location }} />;

  if (isAuthLoading || !user) {
    return <main className="mx-auto max-w-[720px] px-4 pb-20 pt-12 text-sm text-ink-mute sm:px-7">계정 정보를 확인하고 있어요...</main>;
  }

  async function handleDelete(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (deleteAccountMutation.isPending) return;
    if (confirmation !== '탈퇴합니다') {
      setError('확인 문구를 정확히 입력해 주세요.');
      return;
    }

    setError('');
    try {
      await deleteAccount({ password: requiresPassword ? password : undefined });
      navigate('/', { replace: true });
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    }
  }

  return (
    <main className="mx-auto w-full max-w-[720px] px-4 pb-20 pt-9 sm:px-7 sm:pt-12">
      <h1 className="m-0 text-28 font-extrabold tracking-[-0.03em] text-ink">계정 관리</h1>
      <p className="mb-8 mt-2 text-14.5 text-ink-mute">내 정보와 계정 삭제를 관리할 수 있어요.</p>

      <section className="rounded-card border border-line bg-surface p-5 sm:p-6">
        <h2 className="mb-4 mt-0 text-18 font-extrabold text-ink">내 정보</h2>
        <dl className="m-0 grid gap-3 text-sm sm:grid-cols-[100px_1fr]">
          <dt className="font-semibold text-ink-mute">닉네임</dt>
          <dd className="m-0 font-semibold text-ink">{user.nickname}</dd>
          <dt className="font-semibold text-ink-mute">이메일</dt>
          <dd className="m-0 break-all text-ink">{user.email ?? '카카오 계정'}</dd>
        </dl>
      </section>

      <section className="mt-6 rounded-card border border-red-200 dark:border-red-900 bg-surface p-5 sm:p-6">
        <h2 className="mb-2 mt-0 text-18 font-extrabold text-red-700 dark:text-red-400">회원 탈퇴</h2>
        <p className="mb-5 mt-0 text-[13.5px] leading-[1.7] text-ink-mute">
          저장한 도감과 계정 정보는 삭제됩니다. 작성한 후기는 작성자 정보와 분리되어 익명으로 남을 수 있으니, 원하지 않는 후기는 먼저 삭제해 주세요.
        </p>

        <form onSubmit={handleDelete} className="grid gap-4" noValidate>
          {requiresPassword ? (
            <Field label="현재 비밀번호" htmlFor="delete-password">
              <input
                id="delete-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className={inputClass(Boolean(error))}
              />
            </Field>
          ) : null}
          <Field label="확인을 위해 ‘탈퇴합니다’를 입력해 주세요" htmlFor="delete-confirmation">
            <input
              id="delete-confirmation"
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              className={inputClass(Boolean(error))}
            />
          </Field>
          {error ? <p className="m-0 text-13 font-semibold text-red-700 dark:text-red-400" role="alert">{error}</p> : null}
          <button
            type="submit"
            disabled={(requiresPassword && !password) || confirmation !== '탈퇴합니다' || deleteAccountMutation.isPending}
            className="inline-flex min-h-11 w-full items-center justify-center rounded-btn bg-red-700 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-red-800 disabled:cursor-not-allowed disabled:bg-slate-300 dark:disabled:bg-slate-600 sm:w-fit"
          >
            {deleteAccountMutation.isPending ? '탈퇴 처리 중...' : '계정 삭제'}
          </button>
        </form>
      </section>
    </main>
  );
}
