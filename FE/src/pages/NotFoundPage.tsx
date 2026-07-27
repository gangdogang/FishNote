import { Link } from 'react-router';
import { usePageMeta } from '../hooks/usePageMeta';

export default function NotFoundPage() {
  usePageMeta('페이지를 찾을 수 없어요', undefined, null, { noindex: true });

  return (
    <div className="mx-auto max-w-content px-4 py-20 text-center sm:px-7">
      <p className="m-0 text-sm font-bold text-accent">404</p>
      <h1 className="mb-2 mt-1 text-lg font-bold text-ink">페이지를 찾을 수 없어요</h1>
      <p className="mb-6 text-sm text-ink-mute">주소가 바뀌었거나 없는 페이지예요.</p>
      <Link
        to="/"
        className="inline-flex rounded-btn bg-primary px-5 py-2.5 text-body-sm font-bold text-on-primary transition hover:bg-primary-hover"
      >
        홈으로 가기
      </Link>
    </div>
  );
}
