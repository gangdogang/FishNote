import { useEffect, useRef } from 'react';
import { useLocation, useNavigationType } from 'react-router';

interface ScrollPosition {
  x: number;
  y: number;
}

interface TrackedLocation {
  key: string;
  pathname: string;
}

/**
 * Keeps client-side route changes aligned with browser scroll and focus behavior.
 *
 * The first render is intentionally left untouched. New-path navigations start at
 * the top and move focus to the main content, while history navigations restore
 * the position previously recorded for that history entry.
 */
export default function RouteFocusManager() {
  const location = useLocation();
  const navigationType = useNavigationType();
  const previousLocationRef = useRef<TrackedLocation | null>(null);
  const scrollPositionsRef = useRef(new Map<string, ScrollPosition>());

  useEffect(() => {
    if (!('scrollRestoration' in window.history)) return;

    const previousScrollRestoration = window.history.scrollRestoration;
    window.history.scrollRestoration = 'manual';

    return () => {
      window.history.scrollRestoration = previousScrollRestoration;
    };
  }, []);

  useEffect(() => {
    const scrollPositions = scrollPositionsRef.current;
    const currentLocation: TrackedLocation = {
      key: location.key,
      pathname: location.pathname,
    };
    const previousLocation = previousLocationRef.current;
    previousLocationRef.current = currentLocation;

    let frameId: number | undefined;

    if (previousLocation) {
      if (navigationType === 'POP') {
        const savedPosition = scrollPositions.get(currentLocation.key) ?? {
          x: 0,
          y: 0,
        };

        frameId = window.requestAnimationFrame(() => {
          window.scrollTo(savedPosition.x, savedPosition.y);
        });
      } else if (previousLocation.pathname !== currentLocation.pathname) {
        frameId = window.requestAnimationFrame(() => {
          window.scrollTo(0, 0);
          document.getElementById('main-content')?.focus({ preventScroll: true });
        });
      }
    }

    return () => {
      if (frameId !== undefined) window.cancelAnimationFrame(frameId);

      scrollPositions.set(currentLocation.key, {
        x: window.scrollX,
        y: window.scrollY,
      });
    };
  }, [location.key, location.pathname, navigationType]);

  return null;
}
