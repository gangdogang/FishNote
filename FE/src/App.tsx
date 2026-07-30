import { Suspense, lazy } from 'react';
import { Route, Routes, useLocation } from 'react-router';
import AppLayout from './components/AppLayout';
import ErrorBoundary from './components/ErrorBoundary';
import { SkeletonCards } from './components/Skeletons';
import HomePage from './pages/HomePage';

// 첫 화면(홈)만 즉시 로드하고 나머지는 라우트 단위로 코드 스플리팅
const FishDetailPage = lazy(() => import('./pages/FishDetailPage'));
const SearchPage = lazy(() => import('./pages/SearchPage'));
const SavedPage = lazy(() => import('./pages/SavedPage'));
const CalendarPage = lazy(() => import('./pages/CalendarPage'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const SignupPage = lazy(() => import('./pages/SignupPage'));
const KakaoCallbackPage = lazy(() => import('./pages/KakaoCallbackPage'));
const AccountPage = lazy(() => import('./pages/AccountPage'));
const SourcesPage = lazy(() => import('./pages/SourcesPage'));
const PrivacyPage = lazy(() => import('./pages/PrivacyPage'));
const TermsPage = lazy(() => import('./pages/TermsPage'));
const AdminPage = lazy(() => import('./pages/AdminPage'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));

function RouteFallback() {
  return (
    <div className="mx-auto max-w-content px-4 pb-20 pt-7 sm:px-7">
      <SkeletonCards />
    </div>
  );
}

export default function App() {
  const location = useLocation();

  return (
    <AppLayout>
      <ErrorBoundary key={location.pathname}>
        <Suspense fallback={<RouteFallback />}>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/fish/:identifier" element={<FishDetailPage />} />
            <Route path="/search" element={<SearchPage />} />
            <Route path="/saved" element={<SavedPage />} />
            <Route path="/calendar" element={<CalendarPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignupPage />} />
            <Route path="/auth/kakao/callback" element={<KakaoCallbackPage />} />
            <Route path="/account" element={<AccountPage />} />
            <Route path="/sources" element={<SourcesPage />} />
            <Route path="/privacy" element={<PrivacyPage />} />
            <Route path="/terms" element={<TermsPage />} />
            <Route path="/admin" element={<AdminPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </Suspense>
      </ErrorBoundary>
    </AppLayout>
  );
}
