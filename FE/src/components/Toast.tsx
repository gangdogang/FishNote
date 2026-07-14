import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

interface ToastState {
  id: number;
  message: string;
}

interface ToastContextValue {
  showToast: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

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
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-20 z-50 flex justify-center px-4 md:bottom-6">
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

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used within ToastProvider');
  return context;
}
