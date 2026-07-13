import { useEffect, useState } from 'react';
import { authApi } from '../api/auth';

export function GoogleSignInButton() {
  const configured = import.meta.env.VITE_GOOGLE_AUTH_ENABLED;
  const [status, setStatus] = useState(configured === 'false' ? 'unavailable' : 'checking');

  useEffect(() => {
    if (configured === 'false') return undefined;
    let active = true;
    authApi.googleStatus()
      .then((enabled) => active && setStatus(enabled ? 'available' : 'unavailable'))
      .catch(() => active && setStatus('unavailable'));
    return () => { active = false; };
  }, [configured]);

  const unavailable = status !== 'available';
  const base = (import.meta.env.VITE_API_URL || '/api/v1').replace(/\/$/, '');
  return (
    <a
      className={`google-button ${unavailable ? 'google-button--disabled' : ''}`}
      href={unavailable ? undefined : `${base}/auth/google`}
      aria-disabled={unavailable}
      onClick={unavailable ? (event) => event.preventDefault() : undefined}
    >
      <span className="google-mark" aria-hidden="true">G</span>
      <span>{status === 'checking' ? 'Checking Google sign-in…' : unavailable ? 'Google sign-in unavailable' : 'Continue with Google'}</span>
    </a>
  );
}
