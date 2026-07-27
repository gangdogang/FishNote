import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router';

const ANNOUNCEMENT_DELAY_MS = 0;

function getDocumentTitle() {
  return document.title.trim();
}

function getExplicitRouteAnnouncement() {
  const element = document.querySelector<HTMLElement>('[data-route-announcement]');
  const explicitAnnouncement = element?.dataset.routeAnnouncement?.trim();
  return explicitAnnouncement || element?.textContent?.trim() || '';
}

/**
 * Announces SPA page changes without moving focus.
 *
 * A route can commit before its usePageMeta effect (and detail pages can update
 * their title again after data arrives), so both pathname and <title> changes
 * feed the same debounced announcement.
 */
export default function RouteAnnouncer() {
  const { pathname } = useLocation();
  const [announcement, setAnnouncement] = useState('');
  const lastAnnouncementRef = useRef({ pathname: '', text: '' });
  const pathnameRef = useRef(pathname);
  const timerRef = useRef<number | null>(null);

  const scheduleAnnouncement = useCallback(() => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);

    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      const title = getDocumentTitle();
      const explicitAnnouncement = getExplicitRouteAnnouncement();
      const announcement = explicitAnnouncement || (
        pathnameRef.current !== '/' && isDefaultCatalogTitle(title) ? '' : title
      );

      const currentPathname = pathnameRef.current;
      if (!announcement || (
        announcement === lastAnnouncementRef.current.text
        && currentPathname === lastAnnouncementRef.current.pathname
      )) return;

      lastAnnouncementRef.current = { pathname: currentPathname, text: announcement };
      setAnnouncement(announcement);
    }, ANNOUNCEMENT_DELAY_MS);
  }, []);

  useEffect(() => {
    pathnameRef.current = pathname;
    scheduleAnnouncement();
  }, [pathname, scheduleAnnouncement]);

  useEffect(() => {
    const observer = new MutationObserver(scheduleAnnouncement);
    observer.observe(document.head, {
      childList: true,
      characterData: true,
      subtree: true,
    });

    return () => {
      observer.disconnect();
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [scheduleAnnouncement]);

  return (
    <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
      {announcement}
    </div>
  );
}

function isDefaultCatalogTitle(title: string) {
  return title.startsWith('FishNote — 회 도감');
}
