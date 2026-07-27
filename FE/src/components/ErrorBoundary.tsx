import { Component, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

/** 렌더 중 예외가 나도 화면 전체가 하얗게 죽지 않도록 하는 최상위 경계 */
export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="mx-auto max-w-content px-4 py-20 text-center sm:px-7">
          <h1 className="mb-2 text-lg font-bold text-ink">문제가 발생했어요</h1>
          <p className="mb-6 text-sm text-ink-mute">잠시 후 다시 시도해주세요.</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-btn border border-accent bg-surface px-5 py-2.5 text-body-sm font-semibold text-accent transition hover:bg-accent-soft"
          >
            새로고침
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
