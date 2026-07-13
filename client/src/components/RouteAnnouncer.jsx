import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

function routeLabel(pathname) {
  if (pathname === '/login') return 'Sign in';
  if (pathname === '/register') return 'Create account';
  if (pathname === '/forgot-password') return 'Password help';
  if (pathname.startsWith('/auth/')) return 'Completing sign in';
  if (pathname === '/dashboard') return 'Learning dashboard';
  if (pathname === '/courses') return 'Course catalog';
  if (/^\/courses\/[^/]+\/learn(?:\/|$)/.test(pathname)) return 'Course module';
  if (/^\/courses\/[^/]+\/assessment$/.test(pathname)) return 'Course assessment';
  if (/^\/courses\/[^/]+\/results\//.test(pathname)) return 'Assessment result';
  if (/^\/courses\/[^/]+$/.test(pathname)) return 'Course overview';
  if (pathname === '/progress') return 'My progress';
  if (pathname === '/history') return 'Attempt history';
  if (pathname === '/profile') return 'Profile';
  if (pathname === '/admin') return 'Admin dashboard';
  if (pathname === '/admin/courses/new') return 'Create course';
  if (/^\/admin\/courses\/[^/]+\/edit$/.test(pathname)) return 'Edit course';
  if (pathname === '/admin/courses') return 'Course administration';
  if (pathname === '/admin/media') return 'Media library';
  if (pathname === '/admin/users') return 'User administration';
  if (pathname === '/admin/results') return 'Progress and results';
  return 'ITCP Training';
}

function pageHeading() {
  return document.querySelector('.auth-form-wrap h2') || document.querySelector('#main-content h1') || document.querySelector('main h1');
}

export function RouteAnnouncer() {
  const { pathname } = useLocation();
  const label = routeLabel(pathname);

  useEffect(() => {
    document.title = `${label} · ITCP Training`;
    let observer;
    let timeout;
    let frame;
    const focusHeading = () => {
      const heading = pageHeading();
      if (!heading) return false;
      if (!heading.hasAttribute('tabindex')) heading.setAttribute('tabindex', '-1');
      heading.focus({ preventScroll: true });
      return true;
    };
    frame = window.requestAnimationFrame(() => {
      if (focusHeading()) return;
      const root = document.getElementById('root');
      if (!root) return;
      observer = new MutationObserver(() => {
        if (focusHeading()) observer?.disconnect();
      });
      observer.observe(root, { childList: true, subtree: true });
      timeout = window.setTimeout(() => observer?.disconnect(), 5_000);
    });
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timeout);
      observer?.disconnect();
    };
  }, [label, pathname]);

  return <p key={pathname} className="sr-only" role="status" aria-live="polite" aria-atomic="true">{label} page loaded.</p>;
}
