import { isAxiosError } from 'axios';

interface ApiErrorBody {
  message?: string;
}

export function getHttpStatus(error: unknown) {
  return isAxiosError(error) ? error.response?.status : undefined;
}

export function isValidResourceId(id: number) {
  return Number.isSafeInteger(id) && id > 0;
}

/**
 * Read queries retry one transient failure at most. Client errors are expected
 * to stay unchanged on retry, while a missing response represents a network
 * failure and 5xx responses can recover on the next request.
 */
export function retryTransientQueryOnce(failureCount: number, error: unknown) {
  if (failureCount >= 1) return false;

  const status = getHttpStatus(error);
  return status === undefined || status >= 500;
}

export function getErrorMessage(error: unknown) {
  if (isAxiosError(error)) {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      return '인터넷 연결을 확인해 주세요.';
    }
    if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
      return '서버 응답이 늦어지고 있어요. 잠시 후 다시 시도해 주세요.';
    }
    const body = error.response?.data as ApiErrorBody | undefined;
    return body?.message ?? '요청을 처리하지 못했습니다.';
  }
  if (error instanceof Error) {
    return error.message;
  }
  return '요청을 처리하지 못했습니다.';
}
