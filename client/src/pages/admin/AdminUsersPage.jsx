import { useCallback, useEffect, useMemo, useState } from 'react';
import { Search, ShieldCheck, UserRound } from 'lucide-react';
import { adminApi } from '../../api/admin';
import { Badge, EmptyState, ErrorState, LoadingState, TrainingButton, TrainingInput, TrainingModal, TrainingSelect } from '../../branding/components';
import { FeedbackBanner } from '../../components/FeedbackBanner';
import { PageHeader } from '../../components/PageHeader';
import { formatDate } from '../../utils/format';
import { roleLabel } from '../../utils/roles';

function roleTone(role) {
  if (role === 'admin') return 'accent';
  if (role === 'instructor') return 'success';
  return 'neutral';
}

export function AdminUsersPage() {
  const [state, setState] = useState({ loading: true, users: [], error: '' });
  const [query, setQuery] = useState('');
  const [editUser, setEditUser] = useState(null);
  const [draft, setDraft] = useState({ role: 'learner', status: 'active' });
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const load = useCallback(async () => {
    try { setState({ loading: false, users: await adminApi.users(), error: '' }); }
    catch (error) { setState({ loading: false, users: [], error: error.message }); }
  }, []);
  useEffect(() => { load(); }, [load]);
  const visible = useMemo(() => state.users.filter((user) => `${user.name} ${user.email}`.toLowerCase().includes(query.toLowerCase())), [query, state.users]);
  const openEdit = (user) => { setEditUser(user); setDraft({ role: user.role, status: user.status || 'active' }); };
  const save = async () => {
    setSaving(true);
    try { await adminApi.updateUser(editUser._id || editUser.id, draft); setFeedback({ tone: 'success', message: `${editUser.name} updated.` }); setEditUser(null); await load(); }
    catch (error) { setFeedback({ tone: 'danger', message: error.message }); }
    finally { setSaving(false); }
  };
  return (
    <div className="page-stack">
      <PageHeader eyebrow="Access management" title="Users" description="Review learner and instructor accounts and make deliberate role or status changes." />
      {feedback && <FeedbackBanner tone={feedback.tone} onDismiss={() => setFeedback(null)}>{feedback.message}</FeedbackBanner>}
      <div className="filter-bar"><div className="search-field"><Search /><TrainingInput aria-label="Search users" placeholder="Search name or email" value={query} onChange={(event) => setQuery(event.target.value)} /></div><Badge>{visible.length} users</Badge></div>
      {state.loading ? <LoadingState /> : state.error ? <ErrorState message={state.error} onRetry={load} /> : visible.length ? <div className="table-wrap"><table className="training-table"><thead><tr><th>User</th><th>Role</th><th>Status</th><th>Last sign-in</th><th>Joined</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>{visible.map((user) => <tr key={user._id || user.id}><td><span className="table-user"><span className="avatar">{user.name?.charAt(0)?.toUpperCase()}</span><span><strong>{user.name}</strong><small>{user.email}</small></span></span></td><td><Badge tone={roleTone(user.role)}>{roleLabel(user.role)}</Badge></td><td><Badge tone={user.status === 'disabled' ? 'danger' : 'success'}>{user.status || 'active'}</Badge></td><td>{formatDate(user.lastLoginAt)}</td><td>{formatDate(user.createdAt)}</td><td><TrainingButton variant="ghost" size="small" icon={<ShieldCheck />} onClick={() => openEdit(user)}>Manage</TrainingButton></td></tr>)}</tbody></table></div> : <EmptyState title="No users match" message="Try a different name or email." />}
      <TrainingModal open={Boolean(editUser)} onClose={() => setEditUser(null)} title="Manage user access" description="Administrative changes take effect on the next authorized request and are audit logged." footer={<><TrainingButton variant="ghost" onClick={() => setEditUser(null)}>Cancel</TrainingButton><TrainingButton loading={saving} onClick={save}>Save access</TrainingButton></>}><div className="modal-user-summary"><UserRound /><span><strong>{editUser?.name}</strong><small>{editUser?.email}</small></span></div><div className="form-grid"><TrainingSelect label="Role" value={draft.role} onChange={(event) => setDraft((current) => ({ ...current, role: event.target.value }))}><option value="learner">Learner</option><option value="instructor">Instructor</option><option value="admin">Admin</option></TrainingSelect><TrainingSelect label="Account status" value={draft.status} onChange={(event) => setDraft((current) => ({ ...current, status: event.target.value }))}><option value="active">Active</option><option value="disabled">Disabled</option></TrainingSelect></div></TrainingModal>
    </div>
  );
}
