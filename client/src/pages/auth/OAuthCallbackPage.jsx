import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { authApi } from '../../api/auth';
import { useAuth } from '../../auth/AuthContext';
import { ErrorState, LoadingState } from '../../branding/components';
import { AuthShell } from '../../branding/layouts';

export function OAuthCallbackPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { acceptAuthResult, refreshUser } = useAuth();
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    const complete = async () => {
      try {
        let user;
        const code = params.get('code');
        if (code) {
          const result = await authApi.completeGoogle({ code, state: params.get('state') });
          user = result.user;
        }
        user ||= await refreshUser();
        if (!user) throw new Error('Google sign-in could not be completed.');
        if (!active) return;
        acceptAuthResult(user);
        navigate(user.role === 'admin' ? '/admin' : '/dashboard', { replace: true });
      } catch (requestError) {
        if (active) setError(requestError.message || 'Google sign-in could not be completed.');
      }
    };
    complete();
    return () => { active = false; };
  }, [acceptAuthResult, navigate, params, refreshUser]);

  return (
    <AuthShell eyebrow="Secure sign-in" title="Connecting your account">
      {error ? <ErrorState message={error} /> : <LoadingState label="Finishing Google sign-in…" />}
      {error && <Link className="text-link" to="/login">Return to sign in</Link>}
    </AuthShell>
  );
}
