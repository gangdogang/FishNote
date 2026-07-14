import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Analytics } from '@vercel/analytics/react';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { ToastProvider } from './components/Toast';
import { AuthProvider } from './hooks/useAuth';
import { BookmarkProvider } from './hooks/useBookmarks';
import 'pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <AuthProvider>
          <BookmarkProvider>
            <BrowserRouter>
              <App />
            </BrowserRouter>
          </BookmarkProvider>
        </AuthProvider>
      </ToastProvider>
      <Analytics />
    </QueryClientProvider>
  </React.StrictMode>,
);
