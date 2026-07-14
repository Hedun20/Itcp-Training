import { useEffect, useRef, useState } from 'react';
import { ArrowRight, UserCheck } from 'lucide-react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { authApi } from '../../api/auth';
import { useAuth } from '../../auth/AuthContext';
import { ErrorState, LoadingState, TrainingButton, TrainingInput } from '../../branding/components';
import { AuthShell } from '../../branding/layouts';
import { AccountRoleSelector } from '../../components/AccountRoleSelector';
import { FeedbackBanner } from '../../components/FeedbackBanner';
import { roleHomePath } from '../../utils/roles';

export function OAuthCallbackPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { acceptAuthResult, refreshUser } = useAuth();
  const onboardingRequired = params.get('onboarding') === 'required';
  const [error, setError] = useState('');
  const [role, setRole] = useState('learner');
  const [instructorCode, setInstructorCode] = useState('');
  const [fieldError, setFieldError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const callbackStartedRef = useRef(false);
  const submittingRef = useRef(false);

  useEffect(() => {
    if (onboardingRequired || callbackStartedRef.current) return undefined;
    callbackStartedRef.current = true;
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
        navigate(roleHomePath(user.role), { replace: true });
      } catch (requestError) {
        if (active) setError(requestError.message || 'Google sign-in could not be completed.');
      }
    };
    complete();
    return () => { active = false; };
  }, [acceptAuthResult, navigate, onboardingRequired, params, refreshUser]);

  const updateRole = (event) => {
    const nextRole = event.target.value;
    setRole(nextRole);
    if (nextRole === 'learner') setInstructorCode('');
    setFieldError('');
    setError('');
  };

  const completeOnboarding = async (event) => {
    event.preventDefault();
    if (submittingRef.current) return;
    if (role === 'instructor' && !/^\d{6}$/.test(instructorCode)) {
      setFieldError('Enter the six-digit instructor access code.');
      return;
    }
    submittingRef.current = true;
    setSubmitting(true);
    setError('');
    setFieldError('');
    try {
      const result = await authApi.completeGoogleRegistration({
        role,
        ...(role === 'instructor' ? { instructorCode } : {}),
      });
      if (!result.user) throw new Error('Google account setup could not be completed.');
      acceptAuthResult(result.user);
      navigate(roleHomePath(result.user.role), { replace: true });
    } catch (requestError) {
      if (requestError.code === 'INVALID_INSTRUCTOR_CODE') {
        setFieldError('The instructor access code is not valid.');
      } else if (requestError.code === 'INSTRUCTOR_REGISTRATION_DISABLED') {
        setError('Instructor self-registration is not available right now. Choose learner to continue.');
      } else {
        setError(requestError.message || 'Google account setup could not be completed.');
      }
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  if (onboardingRequired) {
    return (
      <AuthShell eyebrow="Google identity verified" title="Choose your account role" description="This choice applies only to your new ITCP Training account. Instructor access requires a server-verified six-digit code.">
        {error && <FeedbackBanner tone="danger">{error}</FeedbackBanner>}
        <form className="auth-form" onSubmit={completeOnboarding} noValidate>
          <AccountRoleSelector value={role} onChange={updateRole} error="" idPrefix="google-onboarding" />
          {role === 'instructor' && <TrainingInput label="Instructor access code" name="instructorCode" type="password" inputMode="numeric" autoComplete="one-time-code" value={instructorCode} onChange={(event) => { setInstructorCode(event.target.value.replace(/\D/g, '').slice(0, 6)); setFieldError(''); setError(''); }} required minLength={6} maxLength={6} pattern="[0-9]{6}" error={fieldError} hint="The code is sent only to the ITCP server for verification." placeholder="Six digits" />}
          <TrainingButton type="submit" loading={submitting} icon={<UserCheck size={18} />}>Continue as {role} <ArrowRight size={17} /></TrainingButton>
        </form>
        <p className="auth-switch"><Link to="/login">Cancel and return to sign in</Link></p>
      </AuthShell>
    );
  }

  return (
    <AuthShell eyebrow="Secure sign-in" title="Connecting your account">
      {error ? <ErrorState message={error} /> : <LoadingState label="Finishing Google sign-in…" />}
      {error && <Link className="text-link" to="/login">Return to sign in</Link>}
    </AuthShell>
  );
}
