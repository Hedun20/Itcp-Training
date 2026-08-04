import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, CheckCircle2, MailCheck, RefreshCw } from 'lucide-react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { authApi } from '../../api/auth';
import { TrainingButton, TrainingCard, TrainingInput } from '../../branding/components';
import { AuthShell } from '../../branding/layouts';
import { FeedbackBanner } from '../../components/FeedbackBanner';

export function EmailVerificationPage() {
  const [params] = useSearchParams();
  const location = useLocation();
  const token = params.get('token')?.trim() || '';
  const initialEmail = params.get('email')?.trim() || '';
  const [email, setEmail] = useState(initialEmail);
  const [verificationState, setVerificationState] = useState(token ? 'checking' : 'waiting');
  const [submitting, setSubmitting] = useState(false);
  const [resent, setResent] = useState(false);
  const [error, setError] = useState('');
  const submittingRef = useRef(false);

  useEffect(() => {
    if (!token) return undefined;
    let active = true;
    authApi.verifyEmail(token)
      .then(() => {
        if (active) setVerificationState('verified');
      })
      .catch((requestError) => {
        if (!active) return;
        setError(requestError.message || 'This verification link is invalid or expired.');
        setVerificationState('failed');
      });
    return () => { active = false; };
  }, [token]);

  const resend = async (event) => {
    event.preventDefault();
    if (submittingRef.current || !email.trim()) return;
    submittingRef.current = true;
    setSubmitting(true);
    setError('');
    setResent(false);
    try {
      await authApi.resendVerification(email.trim());
      setResent(true);
    } catch (requestError) {
      setError(requestError.message || 'A new verification email could not be sent. Try again later.');
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  return (
    <AuthShell
      eyebrow="Email verification"
      title={verificationState === 'verified' ? 'Your email is verified' : 'Confirm your email address'}
      description={verificationState === 'verified'
        ? 'Your ITCP Training account is active and ready to use.'
        : 'Email confirmation prevents other people from registering with your address and protects password recovery.'}
    >
      {location.state?.registered && !token && (
        <FeedbackBanner tone="success">Your account was created. Open the verification link sent to your inbox.</FeedbackBanner>
      )}
      {location.state?.loginBlocked && !token && (
        <FeedbackBanner tone="danger">This account still needs email verification before it can sign in.</FeedbackBanner>
      )}
      {error && <FeedbackBanner tone="danger">{error}</FeedbackBanner>}
      {resent && (
        <FeedbackBanner tone="success">If that address belongs to an unverified account, a new link has been sent.</FeedbackBanner>
      )}

      {verificationState === 'checking' && (
        <TrainingCard className="coming-soon-card">
          <span className="state-icon"><MailCheck /></span>
          <h3>Verifying your email</h3>
          <p>The secure link is being checked. This normally takes only a moment.</p>
        </TrainingCard>
      )}

      {verificationState === 'verified' && (
        <TrainingCard className="coming-soon-card">
          <span className="state-icon"><CheckCircle2 /></span>
          <h3>Account activated</h3>
          <p>You can now sign in with the email address and password used during registration.</p>
          <Link className="training-button" to="/login">Continue to sign in</Link>
        </TrainingCard>
      )}

      {(verificationState === 'waiting' || verificationState === 'failed') && (
        <form className="auth-form" onSubmit={resend} noValidate>
          <TrainingInput
            label="Account email"
            name="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => { setEmail(event.target.value); setError(''); setResent(false); }}
            required
            maxLength={254}
            placeholder="you@company.com"
          />
          <TrainingButton type="submit" loading={submitting} icon={<RefreshCw size={18} />}>
            Send a new verification link
          </TrainingButton>
          <p className="field-message">Check the spam folder as well. Only the newest link remains valid.</p>
        </form>
      )}

      {verificationState !== 'checking' && (
        <Link className="text-link auth-back-link" to="/login"><ArrowLeft size={16} />Back to sign in</Link>
      )}
    </AuthShell>
  );
}
