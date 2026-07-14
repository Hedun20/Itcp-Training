import { useRef, useState } from 'react';
import { ArrowRight, Eye, EyeOff, LockKeyhole } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { AuthShell } from '../../branding/layouts';
import { TrainingButton, TrainingInput } from '../../branding/components';
import { FeedbackBanner } from '../../components/FeedbackBanner';
import { GoogleSignInButton } from '../../components/GoogleSignInButton';
import { roleHomePath } from '../../utils/roles';

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const submittingRef = useRef(false);

  const update = (event) => setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  const submit = async (event) => {
    event.preventDefault();
    if (submittingRef.current) return;
    submittingRef.current = true;
    setError('');
    setSubmitting(true);
    try {
      const user = await login({ email: form.email.trim(), password: form.password });
      const requested = location.state?.from?.pathname;
      navigate(requested || roleHomePath(user.role), { replace: true });
    } catch (requestError) {
      setError(requestError.message || 'Sign-in failed. Check your details and try again.');
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  return (
    <AuthShell eyebrow="Welcome back" title="Sign in to your training" description="Continue your learning securely from where you stopped.">
      {location.state?.registered && <FeedbackBanner tone="success">Your account is ready. Welcome to ITCP Training.</FeedbackBanner>}
      {error && <FeedbackBanner tone="danger">{error}</FeedbackBanner>}
      <GoogleSignInButton />
      <div className="auth-divider"><span>or use email</span></div>
      <form className="auth-form" onSubmit={submit} noValidate>
        <TrainingInput label="Email address" name="email" type="email" autoComplete="email" value={form.email} onChange={update} required placeholder="you@company.com" />
        <div className="password-field-wrap">
          <TrainingInput label="Password" name="password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" value={form.password} onChange={update} required minLength={8} placeholder="Your password" />
          <button type="button" className="password-toggle" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button>
        </div>
        <div className="auth-form-options auth-form-options--end"><Link to="/forgot-password">Forgot password?</Link></div>
        <TrainingButton type="submit" loading={submitting} icon={<LockKeyhole size={18} />}>Sign in <ArrowRight size={17} /></TrainingButton>
      </form>
      <p className="auth-switch">New to ITCP Training? <Link to="/register">Create an account</Link></p>
    </AuthShell>
  );
}
