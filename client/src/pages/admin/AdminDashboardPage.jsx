import { useCallback, useEffect, useState } from 'react';
import { ArrowRight, BookCopy, CheckCircle2, FilePlus2, GraduationCap, UsersRound } from 'lucide-react';
import { Link } from 'react-router-dom';
import { adminApi } from '../../api/admin';
import { Badge, ErrorState, LoadingState, TrainingButton, TrainingCard } from '../../branding/components';
import { PageHeader } from '../../components/PageHeader';
import { formatDate } from '../../utils/format';

export function AdminDashboardPage() {
  const [state, setState] = useState({ loading: true, data: null, error: '' });
  const load = useCallback(async () => {
    try { setState({ loading: false, data: await adminApi.dashboard(), error: '' }); }
    catch (error) { setState({ loading: false, data: null, error: error.message }); }
  }, []);
  useEffect(() => { load(); }, [load]);
  if (state.loading) return <LoadingState label="Loading administration overview…" />;
  if (state.error) return <ErrorState message={state.error} onRetry={load} />;
  const data = state.data || {};
  const metrics = data.metrics || data;
  const recent = data.recentCourses || data.courses || [];
  return (
    <div className="page-stack">
      <PageHeader eyebrow="Administration" title="Training control center" description="Publish trusted learning, monitor adoption, and keep course quality visible." actions={<TrainingButton as={Link} to="/admin/courses/new" icon={<FilePlus2 />}>Create course</TrainingButton>} />
      <section className="metric-grid metric-grid--four attention-group">
        <TrainingCard interactive className="metric-card"><span className="metric-icon"><BookCopy /></span><small>Published courses</small><strong>{metrics.publishedCourses ?? metrics.courses?.published ?? 0}</strong><p>{metrics.draftCourses ?? metrics.courses?.draft ?? 0} drafts in progress</p></TrainingCard>
        <TrainingCard interactive className="metric-card"><span className="metric-icon metric-icon--cyan"><UsersRound /></span><small>Active learners</small><strong>{metrics.activeLearners ?? metrics.users?.active ?? 0}</strong><p>{metrics.totalUsers ?? metrics.users?.total ?? 0} total accounts</p></TrainingCard>
        <TrainingCard interactive className="metric-card"><span className="metric-icon metric-icon--green"><CheckCircle2 /></span><small>Completions</small><strong>{metrics.completions ?? metrics.progress?.completed ?? 0}</strong><p>Recorded course completions</p></TrainingCard>
        <TrainingCard interactive className="metric-card"><span className="metric-icon"><GraduationCap /></span><small>Pass rate</small><strong>{Math.round(metrics.passRate ?? metrics.attempts?.passRate ?? 0)}%</strong><p>{metrics.totalAttempts ?? metrics.attempts?.total ?? 0} assessment attempts</p></TrainingCard>
      </section>
      <div className="admin-dashboard-grid">
        <TrainingCard className="dashboard-panel"><div className="section-heading"><div><p className="eyebrow">Recently updated</p><h2>Course activity</h2></div><Link className="text-link" to="/admin/courses">Manage courses <ArrowRight /></Link></div>{recent.length ? <div className="simple-list">{recent.slice(0, 6).map((course) => <Link key={course._id || course.id} to={`/admin/courses/${course._id || course.id}/edit`}><span className="course-code">{course.code}</span><span><strong>{course.title}</strong><small>Updated {formatDate(course.updatedAt)}</small></span><Badge tone={course.status === 'published' ? 'success' : course.status === 'archived' ? 'neutral' : 'warning'}>{course.status}</Badge></Link>)}</div> : <p className="muted">No course activity yet.</p>}</TrainingCard>
        <TrainingCard className="dashboard-panel"><p className="eyebrow">Operations</p><h2>Quality checklist</h2><ul className="quality-list"><li><CheckCircle2 /><span><strong>Structured content</strong><small>Modules use safe, reusable blocks.</small></span></li><li><CheckCircle2 /><span><strong>Server-side scoring</strong><small>Correct answers remain protected.</small></span></li><li><CheckCircle2 /><span><strong>Publication gates</strong><small>Course requirements are checked before release.</small></span></li></ul></TrainingCard>
      </div>
    </div>
  );
}
