import { useMemo, useState } from 'react';
import { ArrowRight, Eye, EyeOff, UserPlus } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { TrainingButton, TrainingInput } from '../../branding/components';
import { AuthShell } from '../../branding/layouts';
import { FeedbackBanner } from '../../components/FeedbackBanner';
import { GoogleSignInButton } from '../../components/GoogleSignInButton';
import { passwordValidationMessage, validateRegistrationForm } from '../../utils/authValidation';

export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '', confirmPassword: '', authorization: false });
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState({});
  const [generalError, setGeneralError] = useState('');
  const passwordError = useMemo(() => errors.password || (form.password ? passwordValidationMessage(form.password) : ''), [errors.password, form.password]);

  const update = (event) => {
    const { name, value, checked, type } = event.target;
    setForm((current) => ({ ...current, [name]: type === 'checkbox' ? checked : value }));
    setErrors((current) => {
      if (!current[name] && !(name === 'password' && current.confirmPassword)) return current;
      const next = { ...current };
      delete next[name];
      if (name === 'password') delete next.confirmPassword;
      return next;
    });
    setGeneralError('');
  };

  const submit = async (event) => {
    event.preventDefault();
    setGeneralError('');
    const validationErrors = validateRegistrationForm(form);
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length) return;
    setSubmitting(true);
    try {
      await register({ name: form.name.trim(), email: form.email.trim(), password: form.password });
      navigate('/dashboard', { replace: true, state: { registered: true } });
    } catch (requestError) {
      if (requestError.code === 'EMAIL_IN_USE') {
        setErrors((current) => ({ ...current, email: 'An account with this email already exists.' }));
      } else if (requestError.code === 'VALIDATION_ERROR' && requestError.details?.fieldErrors) {
        const fieldErrors = requestError.details.fieldErrors;
        setErrors((current) => ({
          ...current,
          ...Object.fromEntries(Object.entries(fieldErrors).filter(([field, messages]) => ['name', 'email', 'password'].includes(field) && messages?.[0]).map(([field, messages]) => [field, messages[0]])),
        }));
      } else {
        setGeneralError(requestError.message || 'We could not create your account.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell eyebrow="Start learning" title="Create your learner account" description="A focused space for courses, progress, and verified assessment results.">
      {generalError && <FeedbackBanner tone="danger">{generalError}</FeedbackBanner>}
      <GoogleSignInButton />
      <div className="auth-divider"><span>or register with email</span></div>
      <form className="auth-form" onSubmit={submit} noValidate>
        <TrainingInput label="Full name" name="name" autoComplete="name" value={form.name} onChange={update} required minLength={2} maxLength={120} error={errors.name} placeholder="Your full name" />
        <TrainingInput label="Work email" name="email" type="email" autoComplete="email" value={form.email} onChange={update} required maxLength={254} error={errors.email} placeholder="you@company.com" />
        <div className="password-field-wrap">
          <TrainingInput label="Password" name="password" type={showPassword ? 'text' : 'password'} autoComplete="new-password" value={form.password} onChange={update} required minLength={10} maxLength={128} error={passwordError} hint="At least 10 characters with a letter and number." />
          <button type="button" className="password-toggle" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? 'Hide passwords' : 'Show passwords'}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button>
        </div>
        <TrainingInput label="Confirm password" name="confirmPassword" type={showPassword ? 'text' : 'password'} autoComplete="new-password" value={form.confirmPassword} onChange={update} required minLength={10} maxLength={128} error={errors.confirmPassword || (form.confirmPassword && form.password !== form.confirmPassword ? 'Passwords do not match.' : '')} />
        <div className={errors.authorization ? 'check-control-wrap check-control-wrap--error' : 'check-control-wrap'}>
          <label className="check-control"><input name="authorization" type="checkbox" checked={form.authorization} onChange={update} required aria-invalid={Boolean(errors.authorization)} aria-describedby={errors.authorization ? 'registration-authorization-error' : undefined} /><span>I confirm that I am authorised to create and use this ITCP Training account.</span></label>
          {errors.authorization && <span id="registration-authorization-error" className="field-message inline-error" role="alert">{errors.authorization}</span>}
        </div>
        <TrainingButton type="submit" loading={submitting} icon={<UserPlus size={18} />}>Create learner account <ArrowRight size={17} /></TrainingButton>
      </form>
      <p className="auth-switch">Already registered? <Link to="/login">Sign in</Link></p>
    </AuthShell>
  );
}
