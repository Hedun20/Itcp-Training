import { useMemo, useRef, useState } from 'react';
import { ArrowLeft, CheckCircle2, Eye, EyeOff, KeyRound } from 'lucide-react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { authApi } from '../../api/auth';
import { TrainingButton, TrainingInput } from '../../branding/components';
import { AuthShell } from '../../branding/layouts';
import { FeedbackBanner } from '../../components/FeedbackBanner';

function passwordMessage(password) {
  if (password.length < 10) return 'Use at least 10 characters.';
  if (!/[A-Za-z]/.test(password)) return 'Include at least one letter.';
  if (!/\d/.test(password)) return 'Include at least one number.';
  return '';
}

export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = useMemo(() => params.get('token')?.trim() || '', [params]);
  const [form, setForm] = useState({ password: '', confirmPassword: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const submittingRef = useRef(false);

  const update = (event) => {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
    setError('');
  };

  const submit = async (event) => {
    event.preventDefault();
    if (submittingRef.current) return;
    if (!token) {
      setError('This password reset link is incomplete. Request a new one.');
      return;
    }
    const validation = passwordMessage(form.password);
    if (validation) {
      setError(validation);
      return;
    }
    if (form.password !== form.confirmPassword) {
      setError('The passwords do not match.');
      return;
    }

    submittingRef.current = true;
    setSubmitting(true);
    try {
      await authApi.resetPassword(token, form.password);
      navigate('/login', { replace: true, state: { passwordReset: true } });
    } catch (requestError) {
      setError(requestError.message || 'This password reset link is invalid or expired.');
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  return (
    <AuthShell
      eyebrow="Account recovery"
      title="Choose a new password"
      description="The reset link is single-use. After the password changes, existing signed-in sessions are revoked for account safety."
    >
      {!token && <FeedbackBanner tone="danger">This reset link is missing its secure token.</FeedbackBanner>}
      {error && <FeedbackBanner tone="danger">{error}</FeedbackBanner>}
      <form className="auth-form" onSubmit={submit} noValidate>
        <div className="password-field-wrap">
          <TrainingInput
            label="New password"
            name="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="new-password"
            value={form.password}
            onChange={update}
            required
            minLength={10}
            placeholder="At least 10 characters"
          />
          <button type="button" className="password-toggle" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? 'Hide password' : 'Show password'}>
            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
        <TrainingInput
          label="Confirm new password"
          name="confirmPassword"
          type={showPassword ? 'text' : 'password'}
          autoComplete="new-password"
          value={form.confirmPassword}
          onChange={update}
          required
          minLength={10}
          placeholder="Repeat the new password"
        />
        <div className="password-requirements" aria-label="Password requirements">
          <span className={form.password.length >= 10 ? 'is-met' : ''}><CheckCircle2 />10+ characters</span>
          <span className={/[A-Za-z]/.test(form.password) ? 'is-met' : ''}><CheckCircle2 />A letter</span>
          <span className={/\d/.test(form.password) ? 'is-met' : ''}><CheckCircle2 />A number</span>
        </div>
        <TrainingButton type="submit" loading={submitting} disabled={!token} icon={<KeyRound size={18} />}>
          Set new password
        </TrainingButton>
      </form>
      <Link className="text-link auth-back-link" to="/forgot-password"><ArrowLeft size={16} />Request another link</Link>
    </AuthShell>
  );
}
