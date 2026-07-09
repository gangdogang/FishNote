interface RedirectLocation {
  pathname?: unknown;
  search?: unknown;
  hash?: unknown;
}

const AUTH_PATHS = new Set(['/login', '/signup']);

export function getAuthRedirectPath(state: unknown) {
  if (!state || typeof state !== 'object' || !('from' in state)) return '/';

  const from = (state as { from?: unknown }).from;

  if (typeof from === 'string') {
    return isSafeRedirectPath(from) ? from : '/';
  }

  if (!from || typeof from !== 'object') return '/';

  const { pathname, search, hash } = from as RedirectLocation;
  if (typeof pathname !== 'string') return '/';

  const path = [
    pathname,
    typeof search === 'string' ? search : '',
    typeof hash === 'string' ? hash : '',
  ].join('');

  return isSafeRedirectPath(path) ? path : '/';
}

export function getAuthSwitchState(redirectPath: string) {
  return redirectPath === '/' ? undefined : { from: redirectPath };
}

function isSafeRedirectPath(path: string) {
  if (!path.startsWith('/') || path.startsWith('//')) return false;

  const pathname = path.split(/[?#]/, 1)[0];
  return !AUTH_PATHS.has(pathname);
}
