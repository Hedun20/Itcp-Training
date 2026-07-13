import { ArrowLeft, MailCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { TrainingCard } from '../../branding/components';
import { AuthShell } from '../../branding/layouts';

export function ForgotPasswordPage() {
  return (
    <AuthShell eyebrow="Account recovery" title="Password reset is coming next" description="We’re preparing a secure, verified recovery flow rather than offering a form that cannot complete.">
      <TrainingCard className="coming-soon-card">
        <span className="state-icon"><MailCheck /></span>
        <h3>Need access today?</h3>
        <p>Contact your ITCP Training administrator using your registered work email. They can verify your account and help restore access.</p>
      </TrainingCard>
      <Link className="text-link auth-back-link" to="/login"><ArrowLeft size={16} />Back to sign in</Link>
    </AuthShell>
  );
}
