import { useEffect, useState } from 'react';
import { CalendarDays, Mail, Save, ShieldCheck, UserRound } from 'lucide-react';
import { authApi } from '../../api/auth';
import { useAuth } from '../../auth/AuthContext';
import { Badge, TrainingButton, TrainingCard, TrainingInput } from '../../branding/components';
import { FeedbackBanner } from '../../components/FeedbackBanner';
import { PageHeader } from '../../components/PageHeader';
import { formatDate } from '../../utils/format';

export function ProfilePage() {
  const { user, refreshUser } = useAuth();
  const [name, setName] = useState(user?.name || '');
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState(null);
  useEffect(() => { setName(user?.name || ''); }, [user?.name]);
  const submit = async (event) => {
    event.preventDefault();
    if (!name.trim()) return setFeedback({ tone: 'danger', message: 'Name is required.' });
    setSaving(true);
    setFeedback(null);
    try {
      await authApi.updateProfile({ name: name.trim() });
      await refreshUser();
      setFeedback({ tone: 'success', message: 'Your profile has been updated.' });
    } catch (error) { setFeedback({ tone: 'danger', message: error.message || 'Profile could not be updated.' }); }
    finally { setSaving(false); }
  };
  return (
    <div className="page-stack">
      <PageHeader eyebrow="Account" title="Your profile" description="Keep your learner identity accurate and review your account details." />
      <div className="profile-grid">
        <TrainingCard className="profile-summary"><span className="profile-avatar">{user?.name?.charAt(0)?.toUpperCase() || 'U'}</span><h2>{user?.name}</h2><Badge tone="success">Learner</Badge><ul><li><Mail /><span><small>Email</small><strong>{user?.email}</strong></span></li><li><CalendarDays /><span><small>Member since</small><strong>{formatDate(user?.createdAt)}</strong></span></li><li><ShieldCheck /><span><small>Account status</small><strong>{user?.status || 'Active'}</strong></span></li></ul></TrainingCard>
        <TrainingCard className="profile-form-card"><div className="card-heading"><span className="metric-icon"><UserRound /></span><div><h2>Personal information</h2><p>Your email is managed by your secure sign-in identity.</p></div></div>{feedback && <FeedbackBanner tone={feedback.tone}>{feedback.message}</FeedbackBanner>}<form className="form-stack" onSubmit={submit}><TrainingInput label="Full name" value={name} onChange={(event) => setName(event.target.value)} required /><TrainingInput label="Email address" type="email" value={user?.email || ''} readOnly hint="Contact an administrator to change your login email." /><TrainingButton type="submit" loading={saving} icon={<Save />}>Save changes</TrainingButton></form></TrainingCard>
      </div>
    </div>
  );
}
