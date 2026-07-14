import { useMemo, useRef, useState } from 'react';
import { ArrowRight, Eye, EyeOff, UserPlus } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { TrainingButton, TrainingInput } from '../../branding/components';
import { AuthShell } from '../../branding/layouts';
import { FeedbackBanner } from '../../components/FeedbackBanner';
import { GoogleSignInButton } from '../../components/GoogleSignInButton';
import { AccountRoleSelector } from '../../components/AccountRoleSelector';
import { passwordValidationMessage, validateRegistrationForm } from '../../utils/authValidation';

export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ role: 'learner', name: '', email: '', password: '', confirmPassword: '', instructorCode: '', authorization: false });
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState({});
  const [generalError, setGeneralError] = useState('');
  const submittingRef = useRef(false);
  const passwordError = useMemo(() => errors.password || (form.password ? passwordValidationMessage(form.password) : ''), [errors.password, form.password]);

  const update = (event) => {
    const { name, value, checked, type } = event.target;
    const nextValue = name === 'instructorCode' ? value.replace(/\D/g, '').slice(0, 6) : type === 'checkbox' ? checked : value;
    setForm((current) => ({
      ...current,
      [name]: nextValue,
      ...(name === 'role' && nextValue === 'learner' ? { instructorCode: '' } : {}),
    }));
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
    if (submittingRef.current) return;
    setGeneralError('');
    const validationErrors = validateRegistrationForm(form);
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length) return;
    submittingRef.current = true;
    setSubmitting(true);
    try {
      const user = await register({
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
        role: form.role,
        ...(form.role === 'instructor' ? { instructorCode: form.instructorCode } : {}),
      });
      navigate(user.role === 'instructor' ? '/instructor/courses' : '/dashboard', { replace: true, state: { registered: true } });
    } catch (requestError) {
      if (requestError.code === 'EMAIL_IN_USE') {
        setErrors((current) => ({ ...current, email: 'An account with this email already exists.' }));
      } else if (requestError.code === 'INVALID_INSTRUCTOR_CODE') {
        setErrors((current) => ({ ...current, instructorCode: 'The instructor access code is not valid.' }));
      } else if (requestError.code === 'INSTRUCTOR_REGISTRATION_DISABLED') {
        setGeneralError('Instructor self-registration is not available right now. You can still register as a learner.');
      } else if (requestError.code === 'VALIDATION_ERROR' && requestError.details?.fieldErrors) {
        const fieldErrors = requestError.details.fieldErrors;
        setErrors((current) => ({
          ...current,
          ...Object.fromEntries(Object.entries(fieldErrors).filter(([field, messages]) => ['role', 'name', 'email', 'password', 'instructorCode'].includes(field) && messages?.[0]).map(([field, messages]) => [field, messages[0]])),
        }));
      } else {
        setGeneralError(requestError.message || 'We could not create your account.');
      }
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  return (
    <AuthShell eyebrow="Join ITCP Training" title="Create your account" description="Choose how you will use the platform. Instructor access is protected by a server-verified code.">
      {generalError && <FeedbackBanner tone="danger">{generalError}</FeedbackBanner>}
      <GoogleSignInButton />
      <div className="auth-divider"><span>or register with email</span></div>
      <form className="auth-form" onSubmit={submit} noValidate>
        <AccountRoleSelector value={form.role} onChange={update} error={errors.role} />
        <TrainingInput label="Full name" name="name" autoComplete="name" value={form.name} onChange={update} required minLength={2} maxLength={120} error={errors.name} placeholder="Your full name" />
        <TrainingInput label="Work email" name="email" type="email" autoComplete="email" value={form.email} onChange={update} required maxLength={254} error={errors.email} placeholder="you@company.com" />
        {form.role === 'instructor' && <TrainingInput label="Instructor access code" name="instructorCode" type="password" inputMode="numeric" autoComplete="one-time-code" value={form.instructorCode} onChange={update} required minLength={6} maxLength={6} pattern="[0-9]{6}" error={errors.instructorCode} hint="Enter the six-digit code provided by ITCP. It is verified only by the server." placeholder="Six digits" />}
        <div className="password-field-wrap">
          <TrainingInput label="Password" name="password" type={showPassword ? 'text' : 'password'} autoComplete="new-password" value={form.password} onChange={update} required minLength={10} maxLength={128} error={passwordError} hint="At least 10 characters with a letter and number." />
          <button type="button" className="password-toggle" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? 'Hide passwords' : 'Show passwords'}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button>
        </div>
        <TrainingInput label="Confirm password" name="confirmPassword" type={showPassword ? 'text' : 'password'} autoComplete="new-password" value={form.confirmPassword} onChange={update} required minLength={10} maxLength={128} error={errors.confirmPassword || (form.confirmPassword && form.password !== form.confirmPassword ? 'Passwords do not match.' : '')} />
        <div className={errors.authorization ? 'check-control-wrap check-control-wrap--error' : 'check-control-wrap'}>
          <label className="check-control"><input name="authorization" type="checkbox" checked={form.authorization} onChange={update} required aria-invalid={Boolean(errors.authorization)} aria-describedby={errors.authorization ? 'registration-authorization-error' : undefined} /><span>I confirm that I am authorised to create and use this ITCP Training account.</span></label>
          {errors.authorization && <span id="registration-authorization-error" className="field-message inline-error" role="alert">{errors.authorization}</span>}
        </div>
        <TrainingButton type="submit" loading={submitting} icon={<UserPlus size={18} />}>Create {form.role} account <ArrowRight size={17} /></TrainingButton>
      </form>
      <p className="auth-switch">Already registered? <Link to="/login">Sign in</Link></p>
    </AuthShell>
  );
}
