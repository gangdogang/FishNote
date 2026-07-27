import { useEffect, useRef, useState } from 'react';
import { Fish } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { getErrorMessage } from '../lib/errors';
import { consumeKakaoOAuthAttempt, getKakaoCallbackUri } from '../lib/kakaoOAuth';
import { usePageMeta } from '../hooks/usePageMeta';

export default function KakaoCallbackPage() {
  usePageMeta('카카오 로그인', undefined, null, { noindex: true });
  const navigate = useNavigate();
  const { loginWithKakao } = useAuth();
  const startedRef = useRef(false);
  const [error, setError] = useState('');
  const [retryRedirectPath, setRetryRedirectPath] = useState('/');

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    const params = new URLSearchParams(window.location.search);
    window.history.replaceState(window.history.state, '', window.location.pathname);
    let redirectPath = '/';

    async function finishLogin() {
      try {
        redirectPath = consumeKakaoOAuthAttempt(params.get('state'));
        setRetryRedirectPath(redirectPath);
        if (params.get('error')) {
          throw new Error('카카오 로그인이 취소되었습니다.');
        }

        const code = params.get('code');
        if (!code) {
          throw new Error('카카오 인증 코드를 받지 못했습니다. 다시 시도해 주세요.');
        }

        await loginWithKakao({ code, redirectUri: getKakaoCallbackUri() });
        navigate(redirectPath, { replace: true });
      } catch (requestError) {
        setError(getErrorMessage(requestError));
      }
    }

    void finishLogin();
  }, [loginWithKakao, navigate]);

  return (
    <div className="mx-auto flex max-w-content justify-center px-4 pb-20 pt-12 sm:px-7 sm:pt-16">
      <section className="w-full max-w-[400px] rounded-card border border-line bg-surface px-5 py-7 text-center sm:px-6">
        <div className="mb-5 flex items-center justify-center gap-2 text-ink">
          <Fish className="h-4 w-[26px] flex-none text-accent" aria-hidden />
          <span className="text-17 font-extrabold leading-none">FishNote</span>
        </div>
        {error ? (
          <>
            <h1 className="mb-2 mt-0 text-20 font-extrabold text-ink">로그인을 마치지 못했어요</h1>
            <p className="mb-5 mt-0 text-14 leading-[1.6] text-red-700 dark:text-red-400" role="alert">{error}</p>
            <Link
              to="/login"
              replace
              state={retryRedirectPath === '/' ? undefined : { from: retryRedirectPath }}
              className="inline-flex min-h-11 items-center justify-center rounded-btn bg-primary px-5 py-2.5 text-body-sm font-bold text-on-primary no-underline transition hover:bg-primary-hover"
            >
              로그인으로 돌아가기
            </Link>
          </>
        ) : (
          <>
            <h1 className="mb-2 mt-0 text-20 font-extrabold text-ink">카카오 로그인 중</h1>
            <p className="m-0 text-14 text-ink-mute">계정 정보를 안전하게 확인하고 있어요...</p>
          </>
        )}
      </section>
    </div>
  );
}
