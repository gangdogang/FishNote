import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { ToastContext } from '../hooks/useToast';

interface ToastState {
  id: number;
  message: string;
}

const TOAST_DURATION_MS = 3200;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null);
  const timerRef = useRef<number>();

  const showToast = useCallback((message: string) => {
    setToast({ id: Date.now(), message });
  }, []);

  useEffect(() => {
    if (!toast) return;
    timerRef.current = window.setTimeout(() => setToast(null), TOAST_DURATION_MS);
    return () => window.clearTimeout(timerRef.current);
  }, [toast]);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {/* 모바일 하단 탭바 위로 띄우고, 데스크톱에서는 하단 여백만 */}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-[calc(5rem+var(--safe-area-bottom))] z-50 flex justify-center px-4 md:bottom-6">
        {toast ? (
          <div
            key={toast.id}
            className="max-w-[92vw] rounded-full bg-ink px-4.5 py-2.5 text-center text-13 font-semibold leading-snug text-surface shadow-lg"
            role="status"
          >
            {toast.message}
          </div>
        ) : null}
      </div>
    </ToastContext.Provider>
  );
}
