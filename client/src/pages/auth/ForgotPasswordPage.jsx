import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Mail, Send } from 'lucide-react';
import { Link } from 'react-router-dom';
import { authApi } from '../../api/auth';
import { TrainingButton, TrainingCard, TrainingInput } from '../../branding/components';
import { AuthShell } from '../../branding/layouts';
import { FeedbackBanner } from '../../components/FeedbackBanner';

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState('checking');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const submittingRef = useRef(false);

  useEffect(() => {
    let active = true;
    authApi.passwordResetStatus()
      .then((enabled) => active && setStatus(enabled ? 'available' : 'unavailable'))
      .catch(() => active && setStatus('unavailable'));
    return () => { active = false; };
  }, []);

  const submit = async (event) => {
    event.preventDefault();
    if (submittingRef.current || status !== 'available') return;
    submittingRef.current = true;
    setSubmitting(true);
    setError('');
    try {
      await authApi.requestPasswordReset(email.trim());
      setSent(true);
    } catch (requestError) {
      setError(requestError.message || 'Password recovery could not be started. Try again later.');
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  return (
    <AuthShell
      eyebrow="Account recovery"
      title="Reset your password securely"
      description="Enter the email used for your ITCP Training account. A single-use link will be sent when the account is active."
    >
      {status === 'unavailable' && (
        <FeedbackBanner tone="danger">
          Email recovery is not configured on this server yet. Contact an administrator to restore access.
        </FeedbackBanner>
      )}
      {error && <FeedbackBanner tone="danger">{error}</FeedbackBanner>}
      {sent ? (
        <TrainingCard className="coming-soon-card">
          <span className="state-icon"><Mail /></span>
          <h3>Check your inbox</h3>
          <p>If an active account uses <strong>{email.trim()}</strong>, we sent a password reset link. The link expires shortly and can be used only once.</p>
          <TrainingButton variant="secondary" type="button" onClick={() => { setSent(false); setEmail(''); }}>
            Send another request
          </TrainingButton>
        </TrainingCard>
      ) : (
        <form className="auth-form" onSubmit={submit} noValidate>
          <TrainingInput
            label="Account email"
            name="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => { setEmail(event.target.value); setError(''); }}
            required
            placeholder="you@company.com"
            disabled={status !== 'available'}
          />
          <TrainingButton
            type="submit"
            loading={submitting || status === 'checking'}
            disabled={status !== 'available'}
            icon={<Send size={18} />}
          >
            {status === 'checking' ? 'Checking recovery…' : 'Send reset link'}
          </TrainingButton>
        </form>
      )}
      <Link className="text-link auth-back-link" to="/login"><ArrowLeft size={16} />Back to sign in</Link>
    </AuthShell>
  );
}
