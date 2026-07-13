import { CheckCircle2, ShieldCheck, Sparkles } from 'lucide-react';
import { Brand, ThemeToggle } from '../components';

export function AuthShell({ eyebrow, title, description, children }) {
  return (
    <main className="auth-shell">
      <div className="ambient-layer" aria-hidden="true"><span /><span /></div>
      <section className="auth-story" aria-labelledby="auth-story-title">
        <Brand />
        <div className="auth-story-copy">
          <p className="eyebrow">ITCP Europe learning platform</p>
          <h1 id="auth-story-title">Capability that travels into the real work.</h1>
          <p>Clear courses, practical progress, and verified outcomes—designed for focused professional learning.</p>
        </div>
        <ul className="auth-proof-list">
          <li><ShieldCheck aria-hidden="true" /><span><strong>Private by design</strong><small>Your progress stays with your secure account.</small></span></li>
          <li><CheckCircle2 aria-hidden="true" /><span><strong>Resume where you left off</strong><small>Continue across sessions without losing momentum.</small></span></li>
          <li><Sparkles aria-hidden="true" /><span><strong>Built for clarity</strong><small>Structured modules with calm, focused assessment.</small></span></li>
        </ul>
        <p className="auth-story-footer">ITCP Europe · Training with purpose</p>
      </section>
      <section className="auth-panel">
        <div className="auth-panel-toolbar"><span>Secure access</span><ThemeToggle compact /></div>
        <div className="auth-form-wrap">
          <p className="eyebrow">{eyebrow}</p>
          <h2>{title}</h2>
          {description && <p className="auth-description">{description}</p>}
          {children}
        </div>
      </section>
    </main>
  );
}
