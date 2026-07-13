import { useEffect, useRef } from 'react';
import { LogOut, Menu, X } from 'lucide-react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { trapTabKey } from '../../utils/focus';
import { Badge, Brand, ThemeToggle, TrainingButton } from '../components';

export function TrainingShell({ navigation, mobileOpen, setMobileOpen, roleLabel, navLabel }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useMediaQuery('(max-width: 860px)');
  const menuButtonRef = useRef(null);
  const closeButtonRef = useRef(null);
  const drawerClosed = isMobile && !mobileOpen;

  useEffect(() => { setMobileOpen(false); }, [location.pathname, setMobileOpen]);
  useEffect(() => {
    if (!isMobile || !mobileOpen) return undefined;
    const previouslyFocused = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    const frame = window.requestAnimationFrame(() => closeButtonRef.current?.focus());
    const handleDrawerKeys = (event) => {
      if (event.key === 'Escape') setMobileOpen(false);
      else trapTabKey(event, closeButtonRef.current?.closest('aside'));
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleDrawerKeys);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('keydown', handleDrawerKeys);
      document.body.style.overflow = previousOverflow;
      if (previouslyFocused?.isConnected) window.requestAnimationFrame(() => previouslyFocused.focus());
    };
  }, [isMobile, mobileOpen, setMobileOpen]);

  const signOut = async () => {
    try { await logout(); }
    finally { navigate('/login', { replace: true }); }
  };

  return (
    <div className="training-shell">
      <a className="skip-link" href="#main-content">Skip to main content</a>
      <div className="ambient-layer" aria-hidden="true"><span /><span /></div>
      <aside id="app-sidebar" className={`app-sidebar ${mobileOpen ? 'app-sidebar--open' : ''}`} aria-label={navLabel} aria-hidden={drawerClosed ? 'true' : undefined} inert={drawerClosed ? '' : undefined}>
        <div className="sidebar-brand-row">
          <NavLink to={user?.role === 'admin' ? '/admin' : '/dashboard'}><Brand /></NavLink>
          <TrainingButton ref={closeButtonRef} className="mobile-only" variant="ghost" iconOnly icon={<X />} onClick={() => setMobileOpen(false)}>Close navigation</TrainingButton>
        </div>
        <nav className="sidebar-nav">
          {navigation.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} className={({ isActive }) => isActive ? 'active' : undefined}>
              <Icon size={19} aria-hidden="true" /><span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="sidebar-user">
            <span className="avatar" aria-hidden="true">{user?.name?.charAt(0)?.toUpperCase() || 'U'}</span>
            <span><strong>{user?.name || 'ITCP learner'}</strong><small>{user?.email}</small></span>
          </div>
          <TrainingButton variant="ghost" size="small" icon={<LogOut size={17} />} onClick={signOut}>Sign out</TrainingButton>
        </div>
      </aside>
      {mobileOpen && <button className="sidebar-scrim" aria-label="Close navigation" onClick={() => setMobileOpen(false)} />}
      <div className="shell-main-column">
        <header className="app-topbar">
          <TrainingButton ref={menuButtonRef} className="mobile-only" variant="ghost" iconOnly icon={<Menu />} onClick={() => setMobileOpen(true)} aria-expanded={mobileOpen} aria-controls="app-sidebar">Open navigation</TrainingButton>
          <div className="topbar-context"><span>ITCP Europe</span><strong>Professional training</strong></div>
          <div className="topbar-actions"><Badge tone={user?.role === 'admin' ? 'accent' : 'success'}>{roleLabel}</Badge><ThemeToggle compact /></div>
        </header>
        <main id="main-content" className="shell-content" tabIndex={-1}><Outlet /></main>
      </div>
    </div>
  );
}
